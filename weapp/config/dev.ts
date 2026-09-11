import type { UserConfigExport } from "@tarojs/cli";
export default {
  
  defineConstants: {
    DB_SCHEMA: JSON.stringify('test')
  },
  mini: {},
  h5: {}
} satisfies UserConfigExport<'vite'>
