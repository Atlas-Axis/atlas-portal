import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

const ArticlesPageProperties = z.object({
  'Doc No': TitleField,
  Name: RichTextField,
  Content: RichTextField,
  'Needed Research': Relation,
  Tenets: Relation,
  Scenarios: Relation,
  'Original Context Data': Relation,
  'Sections & Primary Docs': Relation,
  Annotations: Relation,
  'Global Tags': Relation,
});
export const ArticlesPageSchema = makePageSchema(ArticlesPageProperties);
