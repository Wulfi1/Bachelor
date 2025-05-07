// TimeExtension.js
export default {
    name: 'TimeExtension',
    uri:  'http://example.com/time',
    prefix: 'time',
    xml: { tagAlias: 'lowerCase' },
    types: [
        {
            name: 'Task',
            extends: ['bpmn:Task'],
            properties: [
                {
                    name: 'timeMin',
                    type: 'String',
                    isAttr: true,
                    attributeName: {
                        localName: 'timeMin',
                        uri: 'http://example.com/time'
                    }
                },
                {
                    name: 'timeMax',
                    type: 'String',
                    isAttr: true,
                    attributeName: {
                        localName: 'timeMax',
                        uri: 'http://example.com/time'
                    }
                }
            ]
        }
    ]
};
