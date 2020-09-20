const { src, dest, watch, series, parallel, lastRun } = require('gulp');
const loadPlugins = require('gulp-load-plugins');
const $ = loadPlugins();
const pkg = require('./package.json');
const del = require('del');
const processhtml = require('gulp-processhtml');
const processhtmlOption = {
  /* plugin options */
};
const conf = pkg['gulp-config'];
const sizes = conf.sizes;
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const tailwindcss = require('tailwindcss');
const purgecss = require('gulp-purgecss');
const cssnano = require('cssnano');
const browserSync = require('browser-sync');
const phpServer = require('gulp-connect-php');
const server = browserSync.create();
const isProd = process.env.NODE_ENV === 'production';

function icon(done) {
  for (let size of sizes) {
    let width = size[0];
    let height = size[1];
    src('./favicon.png')
      .pipe(
        $.imageResize({
          width,
          height,
          crop: true,
          upscale: false,
        })
      )
      .pipe($.rename(`favicon-${width}x${height}.png`))
      .pipe(dest('./dist/assets/icon'));
  }
  done();
}
function favicon() {
  return src('./src/favicon.ico').pipe(dest('./dist'));
}
function html() {
  return src('./src/**/*.html').pipe(processhtml()).pipe(dest('./dist'));
}

function php() {
  return src('./src/**/*.php').pipe(dest('./dist'));
}

function manifest() {
  return src('./src/manifest.json').pipe(dest('./dist'));
}

function styles() {
  return (
    src('./src/assets/sass/style.scss')
      .pipe($.if(!isProd, $.sourcemaps.init()))
      .pipe($.sass())
      // .pipe(postcss([tailwindcss(), autoprefixer()]))
      // .pipe(postcss([require('tailwindcss'), require('autoprefixer')]))
      .pipe($.postcss([tailwindcss('./tailwind.config.js'), autoprefixer()]))
      .pipe(
        $.if(
          isProd,
          $.purgecss({
            content: ['./src/**/*.php', './src/**/*.html'],
            defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
          })
        )
      )

      .pipe($.if(!isProd, $.sourcemaps.write('.')))
      .pipe($.if(isProd, $.postcss([cssnano({ safe: true, autoprefixer: false })])))
      .pipe(dest('./dist/assets/css'))
  );
}

function scripts() {
  return src('./src/assets/js/*.js')
    .pipe($.if(!isProd, $.sourcemaps.init()))
    .pipe($.babel())
    .pipe($.if(!isProd, $.sourcemaps.write('.')))
    .pipe($.if(isProd, $.uglify()))
    .pipe(dest('./dist/assets/js'));
}

function lint() {
  return src('./src/assets/js/*.js')
    .pipe($.eslint({ fix: true }))
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError())
    .pipe(dest('./src/assets/js'));
}

function optimizeImages() {
  return src('./src/assets/images/**', { since: lastRun(optimizeImages) })
    .pipe($.imagemin())
    .pipe(dest('./dist/assets/images'));
}

function clean() {
  return del(['./dist']);
}

function reload() {
  browserSync.reload();
}

function startAppServer() {
  phpServer.server(
    {
      base: './dist',
      port: 4002,
      keepalive: true,
      bin: '/Applications/MAMP/bin/php/php7.2.8/bin/php',
      ini: '/Applications/MAMP/bin/php/php7.2.8/conf/php.ini',
    },
    function () {
      browserSync({
        baseDir: './dist',
        proxy: '127.0.0.1:4002',
        port: 4002,
      });
    }
  );

  watch('./src/**/*.html', html);
  watch('./src/**/*.php', php);
  watch('./src/manifest.json', manifest);
  watch('./src/assets/sass/*.scss', styles);
  watch('./src/assets/js/*.js', scripts);
  watch(['./src/assets/images/*.png', './src/assets/images/*.jpg'], optimizeImages);
  watch([
    './src/**/*.html',
    './src/**/*.php',
    './src/manifest.json',
    './src/assets/sass/*.scss',
    './src/assets/js/*.js',
    './src/assets/images/*.png',
    './src/assets/images/*.jpg',
  ]).on('change', reload);
}

const build = series(
  clean,
  parallel(optimizeImages, icon, favicon, manifest, html, php, styles, series(lint, scripts))
);
const serve = series(build, startAppServer);

exports.icon = icon;
exports.favicon = favicon;
exports.manifest = manifest;
exports.html = html;
exports.php = php;
exports.styles = styles;
exports.scripts = scripts;
exports.build = build;
exports.lint = lint;
exports.serve = serve;
exports.default = serve;
