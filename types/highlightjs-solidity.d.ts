declare module 'highlightjs-solidity' {
  import type { HLJSApi, LanguageFn } from 'highlight.js';

  /**
   * Default export: a registrar that adds the `solidity` and `yul` languages
   * to the given highlight.js instance. The individual grammars are also
   * exposed as named properties.
   */
  const registerSolidity: ((hljs: HLJSApi) => void) & {
    solidity: LanguageFn;
    yul: LanguageFn;
  };

  export default registerSolidity;
}
