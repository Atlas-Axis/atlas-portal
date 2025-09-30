import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

export const AnnotationsPageProperties = z.object({
  'Doc No': TitleField,
  Name: RichTextField,
  Content: RichTextField,
  'Needed Research': Relation,
  'Original Context Data': Relation,
  'Global Tags': Relation,
});

export const AnnotationsPageSchema = makePageSchema(AnnotationsPageProperties);
