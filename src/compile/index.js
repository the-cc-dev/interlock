import escodegen from "escodegen";
import _ from "lodash";
import Promise from "bluebird";

import pluggable from "../pluggable";
import bootstrapCompilation from "./bootstrap";
import { constructBundle } from "./construct";
import getModuleSeeds from "./modules/get-seeds";
import generateModuleMaps from "./modules/generate-maps";
import generateBundles from "./bundles/generate";


export const getUrls = pluggable(function getUrls (bundles) {
  return bundles.reduce((urls, bundle) => {
    bundle.moduleHashes.forEach(hash => urls[hash] = bundle.dest);
    return urls;
  }, {});
});

export const emitRawBundles = pluggable(function emitRawBundles (bundlesArr, urls) {
  const format = this.opts.pretty === false ?
    {
      compact: true,
      newline: ""
    } : {
      indent: {
        style: "  ",
        adjustMultilineComment: true
      }
    };

  return Promise.all(bundlesArr.map(bundle =>
    this.constructBundle({
      modules: bundle.modules,
      includeRuntime: bundle.includeRuntime,
      urls: bundle.isEntry ? urls : null,
      entryModuleHash: bundle.isEntry && bundle.module && bundle.module.hash || null
    })
      .then(bundleAst => escodegen.generate(bundleAst, {
        format,
        sourceMap: !!this.opts.sourceMaps,
        sourceMapWithCode: true,
        comment: !!this.opts.includeComments
      }))
      .then(({ code, map }) => {
        const outputBundle = Object.assign({}, bundle, { raw: code });
        const mapDest = bundle.dest + ".map";
        return this.opts.sourceMaps === true ?
          [outputBundle, { raw: map, dest: mapDest }] :
          [outputBundle];
      })
  ))
    .then(_.flatten);
}, { constructBundle });

/**
 * Given a stream of bundles, reduces those bundles down into a promise that
 * resolves into a final compilation object.
 *
 * This compilation object will have three key/value pairs:
 *
 * - cache:    populated cache from the compilation
 * - bundles:  a mapping of destination paths to `raw` code
 * - opts:     the original options passed to the compilation)
 *
 * @param  {Stream} bundles   Bundles generated by [generateBundles](#getbundles).
 *
 * @return {Promise}          Compilation object.
 */
export const buildOutput = pluggable(function buildOutput (bundles) {
  return this.getUrls(bundles)
    .then(urls => this.emitRawBundles(bundles, urls))
    .then(rawBundles => _.chain(rawBundles)
        .map(rawBundle => [rawBundle.dest, rawBundle])
        .object()
        .value())
    .then(bundlesByDest => ({
      bundles: bundlesByDest,
      opts: this.opts,
      cache: this.cache
    }));
}, { getUrls, emitRawBundles });

/**
 * Performs an end-to-end compilation.
 *
 * @return {Promise}  compilation      Resolves to the compilation output.
 */
const compile = pluggable(function compile () {
  return this.getModuleSeeds()
    .then(moduleSeeds => Promise.all([
      moduleSeeds,
      this.generateModuleMaps(_.values(moduleSeeds))
    ]))
    .then(([moduleSeeds, moduleMaps]) => this.generateBundles(moduleSeeds, moduleMaps))
    .then(this.buildOutput);
}, { getModuleSeeds, generateModuleMaps, generateBundles, buildOutput });


export default function (opts) {
  const compilationContext = bootstrapCompilation(opts);
  return compile.call(compilationContext);
}
