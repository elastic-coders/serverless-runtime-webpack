'use strict';

module.exports = function(S) {

  const SError = require(S.getServerlessPath('Error')),
    SCli       = require(S.getServerlessPath('utils/cli')),
    R          = require('ramda'),
    webpack    = require('webpack'),
    BbPromise  = require('bluebird'),
    chalk      = require('chalk'),
    spawnSync  = require('child_process').spawnSync,
    path       = require('path'),
    fs         = BbPromise.promisifyAll(require('fs'));

  class RuntimeWebpack extends S.classes.Runtime {

    constructor() {
      super();
    }

    static getName() {
      return 'webpack';
    }

    getName(providerName) {
      if (providerName === 'aws') {
        return 'nodejs';
      } else {
        return RuntimeWebpack.getName();
      }
    }

    /**
     * Scaffold
     * - Create scaffolding for new Node.js function
     */

    scaffold(func) {
      const handlerPath = path.resolve(__dirname, '..', 'templates', 'handler.js');
      const webpackPath = path.resolve(__dirname, '..', 'templates', 'webpack.config.js');

      func.handler = 'handler.default';
      func.custom.webpack = {
        configPath: path.join(func.name, 'webpack.config.js'),
      };
      func.custom.handlerExt = 'js';

      return BbPromise.all([
        fs.readFileAsync(handlerPath),
        fs.readFileAsync(webpackPath),
      ])
        .then(files => BbPromise.all([
          func.save(),
          S.utils.writeFile(func.getRootPath('handler.js'), files[0]),
          S.utils.writeFile(func.getRootPath('webpack.config.js'), files[1]),
          S.utils.writeFile(func.getRootPath('event.json'), {})
        ]));
    }

    /**
     * Run
     * - Run this function locally
     */

    run(func, stage, region, event) {

      return this
        .getEnvVars(func, stage, region)
        .then((envVars) => {
          const childArgs = [__dirname + '/webpack-runner'];
          const resultSep = '___serverless_function_run_results___';
          const input = JSON.stringify({
            event,
            resultSep,
            handler: func.handler,
            name: func.getDeployedName({stage, region}),
            dir: func.getRootPath(),
            projectDir: S.config.projectPath,
            webpackConfig: this.getWebpackConfig(func, path.join(S.config.projectPath, '.tmp'), true),
          });

          const env = Object.assign(envVars, process.env, {
            NODE_PATH: path.resolve(__dirname, '..', 'node_modules')
          });

          const child = spawnSync(process.execPath, childArgs, {env, input});

          if (child.error) return BbPromise.reject(child.error);

          if (!R.isEmpty(child.stderr.toString())) {
            SCli.log(chalk.red.bold('Failed - This Error Was Thrown:'));
            console.error(child.stderr.toString());
            return BbPromise.resolve();
          }

          const resultArray = child.stdout.toString().split(resultSep);
          let results = resultArray[1]

          try {
            results = JSON.parse(resultArray[1]);
          } catch(e) {}

          if (!R.isEmpty(resultArray[0])) process.stdout.write(resultArray[0]);

          if (results.status === 'success') {
            SCli.log(chalk.green.bold('Success! - This Response Was Returned:'));
            console.log(JSON.stringify(results.response, null, 2));
          } else {
            SCli.log(chalk.red.bold('Failed - This Error Was Returned:'));
            SCli.log(results.response);
            if (results.stack) console.log(results.stack);
          }

          return BbPromise.resolve(results);
        });
    }

    /**
     * Build
     * - Build the function in this runtime
     */

    build(func, stage, region) {

      // Validate
      if (!func._class || func._class !== 'Function') return BbPromise.reject(new SError('A function instance is required'));

      return this.createDistDir(func.name).then(pathDist => {
        return this.copyFunction(func, pathDist, stage, region)
          .then(() => this._addEnvVarsInline(func, pathDist, stage, region))
          .then(() => this._webpackCompile(func, pathDist))
          .then(() => this._cleanup(pathDist))
          .then(() => pathDist);
      });
    }

    getWebpackConfig(func, pathDist, ignoreConfigPath) {
      const project = S.getProject();
      let webpackConfig = (
        R.path(['custom', 'webpack'], func) ||
        R.path(['custom', 'webpack'], project) ||
        {
          configPath: path.join(func.name, 'webpack.config.js'),
        }
      );
      const handlerName = func.getHandler().split('.')[0];
      const handlerExt = (
        R.path(['custom', 'handlerExt'], func) ||
        R.path(['custom', 'handlerExt'], project) ||
        'js'
      );
      const handlerFileName = handlerName + '.' + handlerExt;
      if (!ignoreConfigPath && webpackConfig.configPath) {
        const projectPath = S.config.projectPath;
        const configPath = path.join(projectPath, webpackConfig.configPath);
        webpackConfig = require(configPath);
      }
      webpackConfig = R.merge({
        context: path.dirname(func.getFilePath()),
        entry: './' + handlerFileName,
        output: {
          libraryTarget: 'commonjs',
          path: pathDist,
          filename: handlerFileName,
        },
      }, webpackConfig);
      return webpackConfig;
    }

    _webpackCompile(func, pathDist) {
      const config = this.getWebpackConfig(func, pathDist);
      const compiler = webpack(config);

      return BbPromise
        .fromCallback(cb => compiler.run(cb))
        .then(stats => console.log(stats));
    }


    /**
     * Get Handler
     */

    getHandler(func) {
      return path.join(path.dirname(func.handler), "_serverless_handler.handler").replace(/\\/g, '/');
    }

    /**
     * Install NPM Dependencies
     */

    installDependencies(dir) {
      SCli.log(`Installing NPM dependencies in dir: ${dir}`);
      SCli.log(`-----------------`);
      S.utils.npmInstall(S.getProject().getRootPath(dir));
      SCli.log(`-----------------`);
    }

    /**
     * Add ENV Vars In-line
     * - Adds a new handler that loads in ENV vars before running the main handler
     */

    _addEnvVarsInline(func, pathDist, stage, region) {

      return this.getEnvVars(func, stage, region)
        .then(envVars => {

          const handlerArr = func.handler.split('.'),
            handlerDir = path.dirname(func.handler),
            handlerFile = handlerArr[0].split('/').pop(),
            handlerMethod = handlerArr[1];

          const loader = `
            const envVars = ${JSON.stringify(envVars, null, 2)};

            for (let key in envVars) {
              process.env[key] = envVars[key];
            }

            exports.handler = (event, context) => {
              try {
                const result = require('./${handlerFile}')['${handlerMethod}'](event, context);

                if (result && typeof result.then == 'function') {
                  result.then(context.succeed).catch(context.fail);
                  return;
                }

                if(result !== undefined) context.succeed(result);
              } catch(e) {
                context.fail(e);
              }
            };
          `;

          return fs.writeFileAsync(path.join(pathDist, handlerDir, '_serverless_handler.js'), loader);
        });
    }

    /**
     * Cleanup pathDist
     * - removes all non-bundled .js and .json files from the pathDist
     */

    _cleanup(pathDist) {
      let ignore = '**/_serverless_handler.js';
      S.utils.sDebug('cleaning up');
      return BbPromise
        .fromCallback(cb => require('glob')(`${pathDist}/**/*+(.js|.json)`, {ignore}, cb))
        .map((filepath) => fs.lstatAsync(filepath).then(stats => stats.isFile() && fs.unlinkAsync(filepath)))
        .then(() => S.utils.sDebug('done cleaning up'))
    }

  }

  return RuntimeWebpack;

};
