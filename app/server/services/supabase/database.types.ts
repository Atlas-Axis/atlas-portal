export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4';
  };
  public: {
    Tables: {
      notion_blocks: {
        Row: {
          archived: boolean;
          belongs_to_edit_page: boolean;
          block_type: string;
          canonical_document_title: string | null;
          created_at: string;
          edit_page_original_notion_block_id: string | null;
          edit_page_original_notion_page_id: string | null;
          has_children: boolean;
          in_trash: boolean;
          json_content: Json | null;
          last_edited_by_user_id: string | null;
          notion_block_id: string;
          parent_notion_block_id: string | null;
          plain_text_content: string | null;
          root_notion_block_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          belongs_to_edit_page?: boolean;
          block_type: string;
          canonical_document_title?: string | null;
          created_at?: string;
          edit_page_original_notion_block_id?: string | null;
          edit_page_original_notion_page_id?: string | null;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_block_id: string;
          parent_notion_block_id?: string | null;
          plain_text_content?: string | null;
          root_notion_block_id: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          belongs_to_edit_page?: boolean;
          block_type?: string;
          canonical_document_title?: string | null;
          created_at?: string;
          edit_page_original_notion_block_id?: string | null;
          edit_page_original_notion_page_id?: string | null;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_block_id?: string;
          parent_notion_block_id?: string | null;
          plain_text_content?: string | null;
          root_notion_block_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_parent_block';
            columns: ['parent_notion_block_id'];
            isOneToOne: false;
            referencedRelation: 'notion_blocks';
            referencedColumns: ['notion_block_id'];
          },
        ];
      };
      notion_database_pages: {
        Row: {
          archived: boolean;
          atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number: string;
          atlas_document_type: Database['public']['Enums']['atlas_document_type_enum'];
          canonical_document_title: string | null;
          child_active_data_ids: Json;
          child_agent_scope_ids: Json;
          child_annotation_ids: Json;
          child_article_ids: Json;
          child_needed_research_ids: Json;
          child_scenario_ids: Json;
          child_scenario_variation_ids: Json;
          child_scope_ids: Json;
          child_section_and_primary_doc_ids: Json;
          child_tenet_ids: Json;
          created_at: string;
          has_children: boolean;
          in_trash: boolean;
          json_content: Json | null;
          json_name: Json | null;
          last_edited_by_user_id: string | null;
          notion_page_id: string;
          plain_text_content: string | null;
          plain_text_name: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number?: string;
          atlas_document_type: Database['public']['Enums']['atlas_document_type_enum'];
          canonical_document_title?: string | null;
          child_active_data_ids?: Json;
          child_agent_scope_ids?: Json;
          child_annotation_ids?: Json;
          child_article_ids?: Json;
          child_needed_research_ids?: Json;
          child_scenario_ids?: Json;
          child_scenario_variation_ids?: Json;
          child_scope_ids?: Json;
          child_section_and_primary_doc_ids?: Json;
          child_tenet_ids?: Json;
          created_at?: string;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id: string;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          atlas_database_name?: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number?: string;
          atlas_document_type?: Database['public']['Enums']['atlas_document_type_enum'];
          canonical_document_title?: string | null;
          child_active_data_ids?: Json;
          child_agent_scope_ids?: Json;
          child_annotation_ids?: Json;
          child_article_ids?: Json;
          child_needed_research_ids?: Json;
          child_scenario_ids?: Json;
          child_scenario_variation_ids?: Json;
          child_scope_ids?: Json;
          child_section_and_primary_doc_ids?: Json;
          child_tenet_ids?: Json;
          created_at?: string;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id?: string;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      notion_sync_status: {
        Row: {
          blocks_synced_count: number | null;
          created_at: string | null;
          id: string;
          is_sync_locked: boolean | null;
          last_sync_completed_at: string | null;
          last_sync_started_at: string | null;
          notion_database_id: string;
          sync_error_message: string | null;
          sync_lock_acquired_at: string | null;
          sync_lock_expires_at: string | null;
          sync_status: string;
          updated_at: string | null;
        };
        Insert: {
          blocks_synced_count?: number | null;
          created_at?: string | null;
          id?: string;
          is_sync_locked?: boolean | null;
          last_sync_completed_at?: string | null;
          last_sync_started_at?: string | null;
          notion_database_id: string;
          sync_error_message?: string | null;
          sync_lock_acquired_at?: string | null;
          sync_lock_expires_at?: string | null;
          sync_status?: string;
          updated_at?: string | null;
        };
        Update: {
          blocks_synced_count?: number | null;
          created_at?: string | null;
          id?: string;
          is_sync_locked?: boolean | null;
          last_sync_completed_at?: string | null;
          last_sync_started_at?: string | null;
          notion_database_id?: string;
          sync_error_message?: string | null;
          sync_lock_acquired_at?: string | null;
          sync_lock_expires_at?: string | null;
          sync_status?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      atlas_database_name_enum:
        | 'Scopes'
        | 'Articles'
        | 'Sections & Primary Docs'
        | 'Annotations'
        | 'Tenets'
        | 'Scenarios'
        | 'Scenario Variations'
        | 'Active Data'
        | 'Agent Scope Database'
        | 'Needed Research'
        | 'Original Context Data';
      atlas_document_type_enum:
        | 'Section'
        | 'Core'
        | 'Type Specification'
        | 'Active Data Controller'
        | 'Spell SP Controller'
        | 'Placeholder'
        | 'Category'
        | 'Action Tenet'
        | 'Active Data'
        | 'Annotation';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      atlas_database_name_enum: [
        'Scopes',
        'Articles',
        'Sections & Primary Docs',
        'Annotations',
        'Tenets',
        'Scenarios',
        'Scenario Variations',
        'Active Data',
        'Agent Scope Database',
        'Needed Research',
        'Original Context Data',
      ],
      atlas_document_type_enum: [
        'Section',
        'Core',
        'Type Specification',
        'Active Data Controller',
        'Spell SP Controller',
        'Placeholder',
        'Category',
        'Action Tenet',
        'Active Data',
        'Annotation',
      ],
    },
  },
} as const;
