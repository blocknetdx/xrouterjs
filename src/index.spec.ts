import 'should';
import * as index from './index';

describe('index', function() {
    it('should export an object', function() {
        index.should.be.an.Object();
    });
});
