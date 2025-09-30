import { z } from 'zod';
import { TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

const MasterStatusPageProperties = z.object({
  Name: TitleField,
});

export const MasterStatusPageSchema = makePageSchema(MasterStatusPageProperties);
