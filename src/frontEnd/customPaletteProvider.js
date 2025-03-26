// src/custom/customPaletteProvider.js

export default function CustomPaletteProvider(
  palette,
  create,
  elementFactory,
  globalConnect,
  handTool
) {
  console.log("[CustomPaletteProvider] constructor called");
  this._palette = palette;
  this._create = create;
  this._elementFactory = elementFactory;
  this._globalConnect = globalConnect;
  this._handTool = handTool;

  // register ourselves as the new palette provider
  palette.registerProvider(this);
}

// We must inject 'handTool' or else we can't reference it
CustomPaletteProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'globalConnect',
  'handTool'
];

CustomPaletteProvider.prototype.getPaletteEntries = function() {
  console.log("[CustomPaletteProvider] getPaletteEntries called");

  const { _create, _elementFactory, _handTool } = this;

  // Helper function to define a shape
  function createAction(bpmnType, group, className, title) {
    return {
      group,
      className,
      title,
      action: {
        dragstart: (event) => {
          const shape = _elementFactory.createShape({ type: bpmnType });
          _create.start(event, shape);
        },
        click: (event) => {
          const shape = _elementFactory.createShape({ type: bpmnType });
          _create.start(event, shape);
        }
      }
    };
  }

  // We'll define a minimal set of entries: hand-tool, start-event
  const entries = {};

  // 1) Start Event
  entries['create.start-event'] = createAction(
    'bpmn:StartEvent',
    'event',
    'bpmn-icon-start-event-none',
    'Create Start Event'
  );

  return entries;
};
