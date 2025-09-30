import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

export const ScenarioVariationsPageProperties = z.object({
  Finding: RichTextField,
  Name: RichTextField,
  'Needed Research': Relation,
  Description: RichTextField,
  'Additional Guidance': RichTextField,
  'Doc No': TitleField,
  'Original Context Data': Relation,
  'Global Tags': Relation,
});

export const ScenarioVariationsPageSchema = makePageSchema(ScenarioVariationsPageProperties);
