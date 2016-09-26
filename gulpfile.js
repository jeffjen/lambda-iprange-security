"use strict"

const babel = require("gulp-babel");
const del = require("del");
const gulp = require("gulp");
const lambda = require("gulp-awslambda");
const shell = require('gulp-shell')
const source = require("vinyl-source-stream");
const zip = require("gulp-zip");

let dest = {
    lambda: "dist"
};

let paths = {
    babel: [
        "src/**/*"
    ],
    src: [
        "lambda.js",
        "package.json",
    ]
};

gulp.task("clean", function () {
    return del([ dest.lambda ]);
});

gulp.task("lambda.npm.babel", function () {
    gulp.src(paths.babel).
        pipe(babel({
            "presets": [ "es2015" ]
        })).
        pipe(gulp.dest(dest.lambda + "/lib"));
});

gulp.task("lambda.npm.src", function () {
    return gulp.src(paths.src).
        pipe(gulp.dest(dest.lambda));
});

gulp.task("lambda.npm", [ "lambda.npm.babel", "lambda.npm.src" ], shell.task([
    `cd ${dest.lambda} && npm install --production`
]));

gulp.task("lambda", [ "lambda.npm" ], function() {
    gulp.src([ `${dest.lambda}/**/*`, `!${dest.lambda}/app.zip` ], { dot: true }).
        pipe(zip("app.zip")).
        pipe(gulp.dest(dest.lambda));
});

gulp.task("default", [ "lambda" ]);

gulp.task("deploy", [ "lambda" ], function () {
    let FunctionName = "lambda-iprange-security";
    gulp.src([ `${dest.lambda}/**/*`, `!${dest.lambda}/app.zip` ]).
        pipe(zip("app.zip")).
        pipe(lambda(FunctionName, { region: "ap-northeast-1" }));
});
