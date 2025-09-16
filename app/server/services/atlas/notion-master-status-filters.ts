import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { MASTER_STATUSES, MASTER_STATUS_ID_MAP } from './constants';

export const NOTION_DATABASE_FILTERS: QueryDatabaseParameters['filter'] = {
  and: [
    {
      and: [
        {
          property: 'Master Status',
          relation: {
            does_not_contain: MASTER_STATUS_ID_MAP[MASTER_STATUSES.DEFERRED],
          },
        },
        {
          property: 'Master Status',
          relation: {
            does_not_contain: MASTER_STATUS_ID_MAP[MASTER_STATUSES.ARCHIVED],
          },
        },
      ],
    },
    {
      or: [
        {
          property: 'Master Status',
          relation: {
            contains: MASTER_STATUS_ID_MAP[MASTER_STATUSES.APPROVED],
          },
        },
        {
          property: 'Master Status',
          relation: {
            contains: MASTER_STATUS_ID_MAP[MASTER_STATUSES.PROVISIONAL],
          },
        },
        {
          property: 'Master Status',
          relation: {
            contains: MASTER_STATUS_ID_MAP[MASTER_STATUSES.PLACEHOLDER],
          },
        },
        // {
        //   property: 'Master Status',
        //   relation: {
        //     is_empty: true,
        //   },
        // },
      ],
    },
  ],
};
