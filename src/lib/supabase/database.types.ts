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
      reserves: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          created_at?: string
          updated_at?: string
        }
      }
      drivers: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          mobile_number: string | null
          department: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          mobile_number?: string | null
          department?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          mobile_number?: string | null
          department?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          plate_number: string
          chassis_number: string
          brand: string
          model: string
          year: number | null
          color: string | null
          vehicle_type: string | null
          is_mobile_maintenance: boolean
          current_odometer: number
          reserve_id: string | null
          driver_id: string | null
          group_assignment: 'A' | 'B' | 'C' | 'D' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plate_number: string
          chassis_number: string
          brand: string
          model: string
          year?: number | null
          color?: string | null
          vehicle_type?: string | null
          is_mobile_maintenance?: boolean
          current_odometer?: number
          reserve_id?: string | null
          driver_id?: string | null
          group_assignment?: 'A' | 'B' | 'C' | 'D' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plate_number?: string
          chassis_number?: string
          brand?: string
          model?: string
          year?: number | null
          color?: string | null
          vehicle_type?: string | null
          is_mobile_maintenance?: boolean
          current_odometer?: number
          reserve_id?: string | null
          driver_id?: string | null
          group_assignment?: 'A' | 'B' | 'C' | 'D' | null
          created_at?: string
          updated_at?: string
        }
      }
      job_cards: {
        Row: {
          id: string
          job_card_number: string
          vehicle_id: string
          type: 'accident' | 'mechanical'
          status: 'received' | 'under_repair' | 'repaired' | 'delivered'
          entry_odometer: number
          exit_odometer: number | null
          has_mechanical_works: boolean
          complaint_description: string | null
          created_at: string
          updated_at: string
          received_at: string
          under_repair_at: string | null
          repaired_at: string | null
          delivered_at: string | null
        }
        Insert: {
          id?: string
          job_card_number?: string
          vehicle_id: string
          type: 'accident' | 'mechanical'
          status?: 'received' | 'under_repair' | 'repaired' | 'delivered'
          entry_odometer: number
          exit_odometer?: number | null
          has_mechanical_works?: boolean
          complaint_description?: string | null
          created_at?: string
          updated_at?: string
          received_at?: string
          under_repair_at?: string | null
          repaired_at?: string | null
          delivered_at?: string | null
        }
        Update: {
          id?: string
          job_card_number?: string
          vehicle_id?: string
          type?: 'accident' | 'mechanical'
          status?: 'received' | 'under_repair' | 'repaired' | 'delivered'
          entry_odometer?: number
          exit_odometer?: number | null
          has_mechanical_works?: boolean
          complaint_description?: string | null
          created_at?: string
          updated_at?: string
          received_at?: string
          under_repair_at?: string | null
          repaired_at?: string | null
          delivered_at?: string | null
        }
      }
      job_card_works: {
        Row: {
          id: string
          job_card_id: string
          work_type: 'accident' | 'mechanical'
          description_ar: string
          description_en: string
          maintenance_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_card_id: string
          work_type: 'accident' | 'mechanical'
          description_ar: string
          description_en: string
          maintenance_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_card_id?: string
          work_type?: 'accident' | 'mechanical'
          description_ar?: string
          description_en?: string
          maintenance_type?: string | null
          created_at?: string
        }
      }
      job_card_spare_parts: {
        Row: {
          id: string
          job_card_id: string
          part_name_ar: string
          part_name_en: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          job_card_id: string
          part_name_ar: string
          part_name_en: string
          quantity?: number
          created_at?: string
        }
        Update: {
          id?: string
          job_card_id?: string
          part_name_ar?: string
          part_name_en?: string
          quantity?: number
          created_at?: string
        }
      }
      job_card_damages: {
        Row: {
          id: string
          job_card_id: string
          damage_description_ar: string
          damage_description_en: string
          created_at: string
        }
        Insert: {
          id?: string
          job_card_id: string
          damage_description_ar: string
          damage_description_en: string
          created_at?: string
        }
        Update: {
          id?: string
          job_card_id?: string
          damage_description_ar?: string
          damage_description_en?: string
          created_at?: string
        }
      }
      service_types: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          category: string
          created_at?: string
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          category?: string
          created_at?: string
        }
      }
      vehicle_history: {
        Row: {
          id: string
          vehicle_id: string
          job_card_id: string | null
          service_type_id: string | null
          odometer: number
          description_ar: string | null
          description_en: string | null
          performed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          vehicle_id: string
          job_card_id?: string | null
          service_type_id?: string | null
          odometer: number
          description_ar?: string | null
          description_en?: string | null
          performed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          job_card_id?: string | null
          service_type_id?: string | null
          odometer?: number
          description_ar?: string | null
          description_en?: string | null
          performed_at?: string
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          language: 'ar' | 'en'
          theme: 'light' | 'dark'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          language?: 'ar' | 'en'
          theme?: 'light' | 'dark'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          language?: 'ar' | 'en'
          theme?: 'light' | 'dark'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
