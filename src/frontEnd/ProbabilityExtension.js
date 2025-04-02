// ProbabilityExtension.js
export default {
    name: 'ProbabilityExtension',
    uri: 'http://example.com/probability',
    prefix: 'prob',
    xml: { tagAlias: 'lowerCase' },
    types: [
        {
            name: 'SequenceFlow',
            extends: ['bpmn:SequenceFlow'],
            properties: [
                {
                    name: 'probability',
                    type: 'String',
                    isAttr: true,
                    attributeName: {
                        localName: 'probability',
                        uri: 'http://example.com/probability'
                    }
                }
            ]
        }
    ]
};
