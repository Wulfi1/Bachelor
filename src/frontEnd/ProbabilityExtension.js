// ProbabilityExtension.js
// This file defines your custom extension so bpmn-js can store "probability" as an attribute 
// on SequenceFlow with the namespace "prob:probability".

export default {
    name: 'ProbabilityExtension',
    uri: 'http://example.com/probability',
    prefix: 'prob',
    xml: {
        tagAlias: 'lowerCase'
    },
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
