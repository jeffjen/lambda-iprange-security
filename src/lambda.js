"use strict"

const AWS = require("aws-sdk");
const Promise = require("bluebird");
const request = require("request-promise");

const ec2 = new AWS.EC2();

const config = require("./config");

function cloudfront(event, context, callback) {
    return getCloudfront(config.useIpv6).
        then((data) => {
            let { ranges, group } = data;
            let { GroupId, IpPermissions } = group;

            let IpRanges;
            if (IpPermissions.length === 0) {
                IpRanges = [];
            } else {
                IpRanges = IpPermissions[0].IpRanges;
            }

            let params = {
                accept: {
                    GroupId: GroupId,
                    IpPermissions: [
                        {
                            FromPort: 443,
                            ToPort: 443,
                            IpProtocol: "tcp",
                            IpRanges: []
                        }
                    ]
                },
                revoke: {
                    GroupId: GroupId,
                    IpPermissions: [
                        {
                            FromPort: 443,
                            ToPort: 443,
                            IpProtocol: "tcp",
                            IpRanges: []
                        }
                    ]
                }
            };

            IpRanges.reduce((params, perm) => {
                let CidrIp = perm.CidrIp;
                let found = ranges.indexOf(CidrIp);
                if (found === -1) {
                    // Revoke access permission from this origin
                    params.revoke.IpPermissions[0].IpRanges.push({ CidrIp: CidrIp });
                } else {
                    // Duplicate found, remove this origin from input
                    ranges.splice(found, 1);
                }
                return params;
            }, params);

            ranges.forEach((CidrIp) => {
                // Accept new origin
                params.accept.IpPermissions[0].IpRanges.push({ CidrIp: CidrIp });
            });

            let resolves = [];
            if (params.revoke.IpPermissions[0].IpRanges.length !== 0){
                resolves.push(ec2.revokeSecurityGroupIngress(params.revoke).promise());
            }
            if (params.accept.IpPermissions[0].IpRanges.length !== 0) {
                resolves.push(ec2.authorizeSecurityGroupIngress(params.accept).promise());
            }
            return Promise.all(resolves);
        }).
        then(() => {
            callback("done");
        }).
        catch((error) => {
            callback(error.message);
        });
}

const ipranges = request({ uri: config.iprangesUri, json: true });

function getCloudfront(useIpv6) {
    function _getIpRanges() {
        return ipranges.then((ranges) => {
            if (useIpv6) {
                return ranges["ipv6_prefixes"].filter((r) => r.service === "CLOUDFRONT").map((r) => r.ipv6_prefix);
            } else {
                return ranges["prefixes"].filter((r) => r.service === "CLOUDFRONT").map((r) => r.ip_prefix);
            }
        });
    }
    function _getSecurityGroup() {
        let params = {
            Filters: [
                {
                    Name: "vpc-id",
                    Values: [ config.vpcId ]
                },
                {
                    Name: "group-name",
                    Values: [ "cloudfront" ]
                }
            ]
        };
        return ec2.describeSecurityGroups(params).promise().then((result) => {
            let group = result.SecurityGroups;
            let params = {
                Description: "White list cloudfront origin",
                GroupName: "cloudfront",
                VpcId: config.vpcId
            };
            if (group.length === 0) {
                return Promise.props({
                    GroupId: ec2.createSecurityGroup(params).promise(),
                    IpPermissions: []
                });
            } else {
                return group[0];
            }
        });
    }
    return Promise.props({
        ranges: _getIpRanges(),
        group: _getSecurityGroup()
    });
}

module.exports = {
    cloudfront
};
