import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { MASTER_STATUS_ID_TO_NAME_MAP } from './constants';

export const NOTION_DATABASE_FILTERS: QueryDatabaseParameters['filter'] = {
  and: [
    {
      and: [
        {
          property: 'Master Status',
          relation: {
            does_not_contain: MASTER_STATUS_ID_TO_NAME_MAP['Deferred'],
          },
        },
        {
          property: 'Master Status',
          relation: {
            does_not_contain: MASTER_STATUS_ID_TO_NAME_MAP['Archived'],
          },
        },
      ],
    },
    {
      or: [
        {
          property: 'Master Status',
          relation: {
            contains: MASTER_STATUS_ID_TO_NAME_MAP['Approved'],
          },
        },
        {
          property: 'Master Status',
          relation: {
            contains: MASTER_STATUS_ID_TO_NAME_MAP['Provisional'],
          },
        },
        {
          property: 'Master Status',
          relation: {
            contains: MASTER_STATUS_ID_TO_NAME_MAP['Placeholder'],
          },
        },
        {
          property: 'Master Status',
          relation: {
            is_empty: true,
          },
        },
      ],
    },
  ],
};
