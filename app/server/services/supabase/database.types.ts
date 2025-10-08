export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4';
  };
  public: {
    Tables: {
      duplicate___notion_database_pages: {
        Row: {
          archived: boolean;
          atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number: string;
          atlas_document_type: Database['public']['Enums']['atlas_document_type_enum'];
          canonical_document_title: string | null;
          created_at: string;
          has_children: boolean;
          in_trash: boolean;
          json_content: Json | null;
          json_name: Json | null;
          last_edited_by_user_id: string | null;
          notion_page_id: string;
          parent_notion_page_id: string | null;
          plain_text_content: string | null;
          plain_text_name: string | null;
          relationships: Json;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number?: string;
          atlas_document_type: Database['public']['Enums']['atlas_document_type_enum'];
          canonical_document_title?: string | null;
          created_at?: string;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id: string;
          parent_notion_page_id?: string | null;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          relationships?: Json;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          atlas_database_name?: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number?: string;
          atlas_document_type?: Database['public']['Enums']['atlas_document_type_enum'];
          canonical_document_title?: string | null;
          created_at?: string;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id?: string;
          parent_notion_page_id?: string | null;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          relationships?: Json;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_logs: {
        Row: {
          changed_notion_page_ids: Json;
          changed_properties_count: number;
          changed_relationships_count: number;
          deleted_pages_count: number;
          duration_minutes: number;
          error_message: string | null;
          finished_at: string;
          has_changes: boolean;
          id: string;
          import_type: string;
          new_pages_count: number;
          started_at: string;
          success: boolean;
          trigger_dev_run_id: string | null;
        };
        Insert: {
          changed_notion_page_ids?: Json;
          changed_properties_count?: number;
          changed_relationships_count?: number;
          deleted_pages_count?: number;
          duration_minutes: number;
          error_message?: string | null;
          finished_at: string;
          has_changes: boolean;
          id?: string;
          import_type: string;
          new_pages_count?: number;
          started_at: string;
          success: boolean;
          trigger_dev_run_id?: string | null;
        };
        Update: {
          changed_notion_page_ids?: Json;
          changed_properties_count?: number;
          changed_relationships_count?: number;
          deleted_pages_count?: number;
          duration_minutes?: number;
          error_message?: string | null;
          finished_at?: string;
          has_changes?: boolean;
          id?: string;
          import_type?: string;
          new_pages_count?: number;
          started_at?: string;
          success?: boolean;
          trigger_dev_run_id?: string | null;
        };
        Relationships: [];
      };
      notion_blocks: {
        Row: {
          archived: boolean;
          block_type: string;
          canonical_document_title: string | null;
          created_at: string;
          has_children: boolean;
          in_trash: boolean;
          json_content: Json | null;
          last_edited_by_user_id: string | null;
          mapped_notion_page_id: string | null;
          notion_block_id: string;
          parent_notion_block_id: string | null;
          plain_text_content: string | null;
          root_notion_toggle_block_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          archived?: boolean;
          block_type: string;
          canonical_document_title?: string | null;
          created_at?: string;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          last_edited_by_user_id?: string | null;
          mapped_notion_page_id?: string | null;
          notion_block_id: string;
          parent_notion_block_id?: string | null;
          plain_text_content?: string | null;
          root_notion_toggle_block_id: string;
          sort_order: number;
          updated_at?: string;
        };
        Update: {
          archived?: boolean;
          block_type?: string;
          canonical_document_title?: string | null;
          created_at?: string;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          last_edited_by_user_id?: string | null;
          mapped_notion_page_id?: string | null;
          notion_block_id?: string;
          parent_notion_block_id?: string | null;
          plain_text_content?: string | null;
          root_notion_toggle_block_id?: string;
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
          atlas_document_number_sortable: string | null;
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
          date_valid_from: string;
          date_valid_to: string | null;
          extra_fields: Json;
          has_children: boolean;
          in_trash: boolean;
          json_content: Json | null;
          json_name: Json | null;
          last_edited_by_user_id: string | null;
          notion_page_id: string;
          parent_notion_page_id: string | null;
          plain_text_content: string | null;
          plain_text_name: string | null;
          sort_order: number | null;
          updated_at: string | null;
        };
        Insert: {
          archived?: boolean;
          atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number?: string;
          atlas_document_number_sortable?: string | null;
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
          date_valid_from?: string;
          date_valid_to?: string | null;
          extra_fields?: Json;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id: string;
          parent_notion_page_id?: string | null;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Update: {
          archived?: boolean;
          atlas_database_name?: Database['public']['Enums']['atlas_database_name_enum'];
          atlas_document_number?: string;
          atlas_document_number_sortable?: string | null;
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
          date_valid_from?: string;
          date_valid_to?: string | null;
          extra_fields?: Json;
          has_children?: boolean;
          in_trash?: boolean;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id?: string;
          parent_notion_page_id?: string | null;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
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
      notion_database_pages_current: {
        Row: {
          archived: boolean | null;
          atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'] | null;
          atlas_document_number: string | null;
          atlas_document_number_sortable: string | null;
          atlas_document_type: Database['public']['Enums']['atlas_document_type_enum'] | null;
          canonical_document_title: string | null;
          child_active_data_ids: Json | null;
          child_agent_scope_ids: Json | null;
          child_annotation_ids: Json | null;
          child_article_ids: Json | null;
          child_needed_research_ids: Json | null;
          child_scenario_ids: Json | null;
          child_scenario_variation_ids: Json | null;
          child_scope_ids: Json | null;
          child_section_and_primary_doc_ids: Json | null;
          child_tenet_ids: Json | null;
          created_at: string | null;
          date_valid_from: string | null;
          date_valid_to: string | null;
          extra_fields: Json | null;
          has_children: boolean | null;
          in_trash: boolean | null;
          json_content: Json | null;
          json_name: Json | null;
          last_edited_by_user_id: string | null;
          notion_page_id: string | null;
          parent_notion_page_id: string | null;
          plain_text_content: string | null;
          plain_text_name: string | null;
          sort_order: number | null;
          updated_at: string | null;
        };
        Insert: {
          archived?: boolean | null;
          atlas_database_name?: Database['public']['Enums']['atlas_database_name_enum'] | null;
          atlas_document_number?: string | null;
          atlas_document_number_sortable?: string | null;
          atlas_document_type?: Database['public']['Enums']['atlas_document_type_enum'] | null;
          canonical_document_title?: string | null;
          child_active_data_ids?: Json | null;
          child_agent_scope_ids?: Json | null;
          child_annotation_ids?: Json | null;
          child_article_ids?: Json | null;
          child_needed_research_ids?: Json | null;
          child_scenario_ids?: Json | null;
          child_scenario_variation_ids?: Json | null;
          child_scope_ids?: Json | null;
          child_section_and_primary_doc_ids?: Json | null;
          child_tenet_ids?: Json | null;
          created_at?: string | null;
          date_valid_from?: string | null;
          date_valid_to?: string | null;
          extra_fields?: Json | null;
          has_children?: boolean | null;
          in_trash?: boolean | null;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id?: string | null;
          parent_notion_page_id?: string | null;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Update: {
          archived?: boolean | null;
          atlas_database_name?: Database['public']['Enums']['atlas_database_name_enum'] | null;
          atlas_document_number?: string | null;
          atlas_document_number_sortable?: string | null;
          atlas_document_type?: Database['public']['Enums']['atlas_document_type_enum'] | null;
          canonical_document_title?: string | null;
          child_active_data_ids?: Json | null;
          child_agent_scope_ids?: Json | null;
          child_annotation_ids?: Json | null;
          child_article_ids?: Json | null;
          child_needed_research_ids?: Json | null;
          child_scenario_ids?: Json | null;
          child_scenario_variation_ids?: Json | null;
          child_scope_ids?: Json | null;
          child_section_and_primary_doc_ids?: Json | null;
          child_tenet_ids?: Json | null;
          created_at?: string | null;
          date_valid_from?: string | null;
          date_valid_to?: string | null;
          extra_fields?: Json | null;
          has_children?: boolean | null;
          in_trash?: boolean | null;
          json_content?: Json | null;
          json_name?: Json | null;
          last_edited_by_user_id?: string | null;
          notion_page_id?: string | null;
          parent_notion_page_id?: string | null;
          plain_text_content?: string | null;
          plain_text_name?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      atlas_document_number_to_sortable: {
        Args: { doc_number: string };
        Returns: string;
      };
      public_get_atlas_page_changes: {
        Args: { p_limit?: number };
        Returns: {
          event_time: string;
          event_type: string;
          new_row: Json;
          notion_page_id: string;
          old_row: Json;
        }[];
      };
      versioned_delete_notion_database_pages: {
        Args: { p_ids: string[] };
        Returns: number;
      };
      versioned_upsert_notion_database_pages: {
        Args: { p_rows: Json };
        Returns: undefined;
      };
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
        | 'Original Context Data'
        | 'Type Specification';
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
        | 'Annotation'
        | 'Scope'
        | 'Article'
        | 'Scenario'
        | 'Scenario Variation'
        | 'Needed Research';
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
        'Type Specification',
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
        'Scope',
        'Article',
        'Scenario',
        'Scenario Variation',
        'Needed Research',
      ],
    },
  },
} as const;
