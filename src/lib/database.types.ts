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
      }
      employees: {
        Row: {
          id: string
          user_id: string | null
          employee_code: string
          full_name: string
          email: string
          phone: string | null
          role: 'field_worker' | 'supervisor' | 'admin'
          active: boolean
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
          role?: 'field_worker' | 'supervisor' | 'admin'
          active?: boolean
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
          role?: 'field_worker' | 'supervisor' | 'admin'
          active?: boolean
          created_at?: string
          updated_at?: string
        }
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
      }
    }
  }
}
