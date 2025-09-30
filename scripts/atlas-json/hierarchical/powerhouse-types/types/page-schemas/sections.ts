import { z } from 'zod';
import { Files, Relation, RichTextField, Select, TitleField } from '../notion-data.js';
import { NotionNumber } from '../processed-data.js';
import { makePageSchema } from './utils.js';

export const SectionPageProperties = z.object({
  'Doc No (or Temp Name)': TitleField,
  Name: RichTextField,
  'Additional Logic': RichTextField,
  Type: Select,
  'Type Category': Select,
  Tenets: Relation,
  Subdocs: Relation,
  Annotations: Relation,
  Content: RichTextField,
  'Doc Identifier Rules': RichTextField,
  'Type Name': RichTextField,
  'Type Overview': RichTextField,
  Components: RichTextField,
  'Active Data': Relation,
  'Needed Research': Relation,
  'Original Context Data': Relation,
  'Parent Doc': Relation,
  'Parent Article ': Relation,
  'No.': NotionNumber,
  'Files & media': Files,
  'Global Tags': Relation,
});
export const SectionsPageSchema = makePageSchema(SectionPageProperties);
