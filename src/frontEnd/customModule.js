// src/custom/customModule.js

import PaletteModule from 'bpmn-js/lib/features/palette';
import CustomPaletteProvider from './customPaletteProvider';

export default {
  __depends__: [ PaletteModule ],
  __init__: [ 'customPaletteProvider' ],
  __replaces__: {
    'paletteProvider': 'customPaletteProvider'
  },
  customPaletteProvider: [ 'type', CustomPaletteProvider ]
};
