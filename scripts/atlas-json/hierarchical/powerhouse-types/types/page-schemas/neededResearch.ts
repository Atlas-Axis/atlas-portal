import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

const NeededResearchPageProperties = z.object({
  Name: RichTextField,
  Content: RichTextField,
  'Doc No': TitleField,
  'Global Tags': Relation,
});

export const NeededResearchPageSchema = makePageSchema(NeededResearchPageProperties);
