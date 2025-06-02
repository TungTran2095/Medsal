
import { config } from 'dotenv';
config();

import '@/ai/flows/echo-user-input.ts';
import '@/ai/tools/supabaseQueryTool.ts';
import '@/ai/tools/dashboardQueryTools.ts';
import '@/ai/flows/list-tools-flow.ts';
    
