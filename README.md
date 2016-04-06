# Webpack Runtime for [Serverless](http://serverless.com)

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

A plugin to use Webpack to run and build your Serverless function.

This plugin is heavily inspired by
[serverless-runtime-babel](https://github.com/serverless/serverless-runtime-babel)
and
[serverless-webpack-plugin](https://github.com/asprouse/serverless-webpack-plugin).

## Features
 *  **Runs locally and deploys functions bundled with [Webpack](https://webpack.github.io)**
 *  Compile all your dependencies in a single JS file
 *  Use any loader you want, [Babel](https://babeljs.io) with ES2015 and stage-0 presets is already
    bundled with this plugin

## Install
**Note:** Serverless v0.5.0 or higher is required.
* Install via npm in the root of your Serverless Project: `npm install serverless-runtime-webpack --save-dev`
* In the `plugins` array in your `s-project.json` add `"serverless-runtime-webpack"`
* Install the loaders you will use in your Webpack configuration `npm install babel-loader --save-dev`
* All done!

## Usage
All you need is to set `runtime` property of `s-function.json` to `webpack`.

From scratch you can:

- `serverless project create` as usual
- `serverless function create myfunc` and select `webpack` when asked for a runtime
- `serverless function run myfun` done!

### Scaffold
You can use `serverless function create` as usual — it will prompt you for a runtime unless you add the `-r webpack` flag.

### Examples
[GitHub stargazers example](https://github.com/elastic-coders/serverless-runtime-webpack/tree/master/examples/stars)
returns amount of starts for a GitHub repo.

Copy the `stars` folder in a Serverless project configured with this plugin as described in the
*Install* section above; then run `serverless function run stars`.

## Options

Configuration options can be used by setting the `custom.runtime` of `s-function.json`. The following options are available:

* `webpack` – The Webpack configuration also accepting an extra (optional) property
  `configPath` with he path of the Webpack configuration file **relative to the project**

### Example

Example Webpack Runtime configuration with default values:

```javascript
{
  /*s-function.json*/
  /*...*/
  "runtime": "webpack",
  "custom": {
    "webpack": {
      "configPath": "myfunc/webpack.config.js"
    }
  },
  /*...*/
}
```
