import {Notification} from '../enums/Notification';
import {NotificationsDataMap} from './NotificationsData';

describe('NotificationsDataMap geospatial scope message', () => {
    it('includes message for external georeferencing scope', () => {
        const content = NotificationsDataMap[Notification.GEOREFERENCING_EXTERNAL_INFO];

        expect(content).toBeDefined();
        expect(content.header).toContain('Geospatial export');
        expect(content.description).toContain('non-georeferenced');
        expect(content.description).toContain('post-processing');
    });
});
