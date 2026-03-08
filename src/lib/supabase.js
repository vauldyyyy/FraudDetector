import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://boxsnuwicriuxxsyciak.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveHNudXdpY3JpdXh4c3ljaWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Njc2NTAsImV4cCI6MjA4ODU0MzY1MH0.U4zhls8kiWyrVG6vunVe7goTXquIMTmoJu1XVMGgJqY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
