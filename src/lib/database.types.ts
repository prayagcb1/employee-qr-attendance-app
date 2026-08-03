export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: {
          id: string
          name: string
          address: string
          qr_code_data: string
          latitude: number | null
          longitude: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          qr_code_data: string
          latitude?: number | null
          longitude?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          qr_code_data?: string
          latitude?: number | null
          longitude?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          user_id: string | null
          employee_code: string
          full_name: string
          email: string
          phone: string | null
          role: 'field_worker' | 'field_supervisor' | 'supervisor' | 'admin' | 'manager' | 'intern' | 'office_employee'
          active: boolean
          username: string | null
          date_of_joining: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          employee_code: string
          full_name: string
          email: string
          phone?: string | null
          role?: 'field_worker' | 'field_supervisor' | 'supervisor' | 'admin' | 'manager' | 'intern' | 'office_employee'
          active?: boolean
          username?: string | null
          date_of_joining?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          employee_code?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: 'field_worker' | 'field_supervisor' | 'supervisor' | 'admin' | 'manager' | 'intern' | 'office_employee'
          active?: boolean
          username?: string | null
          date_of_joining?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          id: string
          employee_id: string
          site_id: string
          event_type: 'clock_in' | 'clock_out'
          timestamp: string
          latitude: number
          longitude: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          site_id: string
          event_type: 'clock_in' | 'clock_out'
          timestamp?: string
          latitude: number
          longitude: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          site_id?: string
          event_type?: 'clock_in' | 'clock_out'
          timestamp?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      bins: {
        Row: {
          id: string
          site_id: string | null
          bin_code: string
          qr_code_data: string | null
          bin_status: string
          capacity_liters: number
          current_weight_kg: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          site_id?: string | null
          bin_code: string
          qr_code_data?: string | null
          bin_status?: string
          capacity_liters?: number
          current_weight_kg?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          site_id?: string | null
          bin_code?: string
          qr_code_data?: string | null
          bin_status?: string
          capacity_liters?: number
          current_weight_kg?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      waste_management_forms: {
        Row: {
          id: string
          employee_id: string
          community: string
          date: string
          recorded_by: string
          waste_segregated: boolean
          total_bins_50kg: number
          issues_identified: string[] | string | null
          composter_status: Record<string, unknown> | string | null
          workflow_stage: string
          scanned_bins: unknown[] | string | null
          remarks: string
          site_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          community: string
          date: string
          recorded_by: string
          waste_segregated?: boolean
          total_bins_50kg?: number
          issues_identified?: string[] | string | null
          composter_status?: Record<string, unknown> | string | null
          workflow_stage?: string
          scanned_bins?: unknown[] | string | null
          remarks?: string
          site_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          community?: string
          date?: string
          recorded_by?: string
          waste_segregated?: boolean
          total_bins_50kg?: number
          issues_identified?: string[] | string | null
          composter_status?: Record<string, unknown> | string | null
          workflow_stage?: string
          scanned_bins?: unknown[] | string | null
          remarks?: string
          site_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      waste_loading_entries: {
        Row: {
          id: string
          form_id: string | null
          employee_id: string
          site_id: string | null
          bin_id: string | null
          bin_code: string
          weight_loaded_kg: number
          waste_type: string
          loading_datetime: string
          collector_name: string
          remarks: string
          created_at: string
        }
        Insert: {
          id?: string
          form_id?: string | null
          employee_id: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          weight_loaded_kg?: number
          waste_type?: string
          loading_datetime?: string
          collector_name?: string
          remarks?: string
          created_at?: string
        }
        Update: {
          id?: string
          form_id?: string | null
          employee_id?: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          weight_loaded_kg?: number
          waste_type?: string
          loading_datetime?: string
          collector_name?: string
          remarks?: string
          created_at?: string
        }
        Relationships: []
      }
      waste_harvest_entries: {
        Row: {
          id: string
          form_id: string | null
          employee_id: string
          site_id: string | null
          bin_id: string | null
          bin_code: string
          compost_harvested_kg: number
          harvest_date: string
          compost_quality: string
          moisture_level: string
          remarks: string
          created_at: string
        }
        Insert: {
          id?: string
          form_id?: string | null
          employee_id: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          compost_harvested_kg?: number
          harvest_date?: string
          compost_quality?: string
          moisture_level?: string
          remarks?: string
          created_at?: string
        }
        Update: {
          id?: string
          form_id?: string | null
          employee_id?: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          compost_harvested_kg?: number
          harvest_date?: string
          compost_quality?: string
          moisture_level?: string
          remarks?: string
          created_at?: string
        }
        Relationships: []
      }
      waste_maintenance_entries: {
        Row: {
          id: string
          form_id: string | null
          employee_id: string
          site_id: string | null
          bin_id: string | null
          bin_code: string
          maintenance_type: string
          status: string
          remarks: string
          photo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          form_id?: string | null
          employee_id: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          maintenance_type?: string
          status?: string
          remarks?: string
          photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          form_id?: string | null
          employee_id?: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          maintenance_type?: string
          status?: string
          remarks?: string
          photo_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      waste_temperature_entries: {
        Row: {
          id: string
          form_id: string | null
          employee_id: string
          site_id: string | null
          bin_id: string | null
          bin_code: string
          temperature_celsius: number
          auto_status: string
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          form_id?: string | null
          employee_id: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          temperature_celsius?: number
          auto_status?: string
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          form_id?: string | null
          employee_id?: string
          site_id?: string | null
          bin_id?: string | null
          bin_code?: string
          temperature_celsius?: number
          auto_status?: string
          recorded_at?: string
          created_at?: string
        }
        Relationships: []
      }
      waste_consumables_entries: {
        Row: {
          id: string
          form_id: string | null
          employee_id: string
          site_id: string | null
          item_name: string
          opening_stock: number
          used: number
          remaining: number
          entry_date: string
          created_at: string
        }
        Insert: {
          id?: string
          form_id?: string | null
          employee_id: string
          site_id?: string | null
          item_name?: string
          opening_stock?: number
          used?: number
          entry_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          form_id?: string | null
          employee_id?: string
          site_id?: string | null
          item_name?: string
          opening_stock?: number
          used?: number
          entry_date?: string
          created_at?: string
        }
        Relationships: []
      }
      analytics_pdf_uploads: {
        Row: {
          id: string
          site_id: string | null
          employee_id: string | null
          file_name: string
          storage_path: string
          status: string
          extracted_data: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id?: string | null
          employee_id?: string | null
          file_name: string
          storage_path: string
          status?: string
          extracted_data?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string | null
          employee_id?: string | null
          file_name?: string
          storage_path?: string
          status?: string
          extracted_data?: unknown | null
          created_at?: string
        }
        Relationships: []
      }
      composters: {
        Row: {
          id: string
          make: string
          model: string
          capacity_liters: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          make: string
          model: string
          capacity_liters: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          make?: string
          model?: string
          capacity_liters?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          id: string
          name: string
          address: string
          wet_waste_bin_size_liters: number
          waste_density_kg_per_ltr: number
          composter_id: string | null
          bins_per_batch: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string
          wet_waste_bin_size_liters?: number
          waste_density_kg_per_ltr?: number
          composter_id?: string | null
          bins_per_batch?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          wet_waste_bin_size_liters?: number
          waste_density_kg_per_ltr?: number
          composter_id?: string | null
          bins_per_batch?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_key_people: {
        Row: {
          id: string
          community_id: string
          role_type: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager'
          name: string
          phone: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          role_type: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager'
          name: string
          phone?: string
          email?: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          role_type?: 'estate_manager' | 'mc_member' | 'caas_supervisor' | 'account_manager'
          name?: string
          phone?: string
          email?: string
          created_at?: string
        }
        Relationships: []
      }
      community_batches: {
        Row: {
          id: string
          community_id: string
          batch_number: string
          status: 'loading' | 'harvesting' | 'maintenance' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          batch_number?: string
          status?: 'loading' | 'harvesting' | 'maintenance' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          batch_number?: string
          status?: 'loading' | 'harvesting' | 'maintenance' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      batch_bin_assignments: {
        Row: {
          id: string
          batch_id: string
          bin_id: string
          selected: boolean
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          bin_id: string
          selected?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          bin_id?: string
          selected?: boolean
          created_at?: string
        }
        Relationships: []
      }
      daily_wet_waste_entries: {
        Row: {
          id: string
          community_id: string
          date: string
          number_of_bins: number
          employee_id: string
          recorded_by: string
          remarks: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          date?: string
          number_of_bins?: number
          employee_id: string
          recorded_by?: string
          remarks?: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          date?: string
          number_of_bins?: number
          employee_id?: string
          recorded_by?: string
          remarks?: string
          created_at?: string
        }
        Relationships: []
      }
      cocopeat_usage_entries: {
        Row: {
          id: string
          community_id: string
          date: string
          bin_id: string | null
          bin_code: string
          quantity_kg: number
          employee_id: string
          remarks: string
          created_at: string
        }
        Insert: {
          id?: string
          community_id: string
          date?: string
          bin_id?: string | null
          bin_code?: string
          quantity_kg?: number
          employee_id: string
          remarks?: string
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          date?: string
          bin_id?: string | null
          bin_code?: string
          quantity_kg?: number
          employee_id?: string
          remarks?: string
          created_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          unit: string
          category: string
          reorder_level: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          unit?: string
          category?: string
          reorder_level?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          unit?: string
          category?: string
          reorder_level?: number
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          id: string
          item_id: string
          community_id: string | null
          transaction_type: 'in' | 'out'
          quantity: number
          balance_after: number
          employee_id: string
          transaction_date: string
          remarks: string
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          community_id?: string | null
          transaction_type: 'in' | 'out'
          quantity?: number
          balance_after?: number
          employee_id: string
          transaction_date?: string
          remarks?: string
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          community_id?: string | null
          transaction_type?: 'in' | 'out'
          quantity?: number
          balance_after?: number
          employee_id?: string
          transaction_date?: string
          remarks?: string
          created_at?: string
        }
        Relationships: []
      }
      inventory_orders: {
        Row: {
          id: string
          item_id: string
          community_id: string | null
          quantity_ordered: number
          status: 'pending' | 'placed' | 'received' | 'cancelled'
          ordered_by: string
          order_date: string
          expected_date: string | null
          remarks: string
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          community_id?: string | null
          quantity_ordered?: number
          status?: 'pending' | 'placed' | 'received' | 'cancelled'
          ordered_by: string
          order_date?: string
          expected_date?: string | null
          remarks?: string
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          community_id?: string | null
          quantity_ordered?: number
          status?: 'pending' | 'placed' | 'received' | 'cancelled'
          ordered_by?: string
          order_date?: string
          expected_date?: string | null
          remarks?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
