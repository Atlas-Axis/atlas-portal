import { z } from 'zod';
import { Relation, RichTextField, TitleField } from '../notion-data.js';
import { makePageSchema } from './utils.js';

export const ScenariosPageProperties = z.object({
  'Doc No (or Temp Name)': TitleField,
  Name: RichTextField,
  'Additional Guidance': RichTextField,
  Description: RichTextField,
  'Scenario Variations': Relation,
  'Master Status': Relation,
  'Needed Research': Relation,
  'Original Context Data': Relation,
  Finding: RichTextField,
  'Global Tags': Relation,
});

export const ScenariosPageSchema = makePageSchema(ScenariosPageProperties);
