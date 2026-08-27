┌──── ○○○ ────┐
│ Semgrep CLI │
└─────────────┘

⠹ Loading rules from registry...                                       
Scanning 124 files (only git-tracked) with:
                                      
✔ Semgrep OSS
  ✔ Basic security coverage for first-party code        
vulnerabilities.                                                       
                                              
✘ Semgrep Code (SAST)
  ✘ Find and fix vulnerabilities in the code you write  
with advanced scanning and expert security rules.                      
                                                     
✘ Semgrep Supply Chain (SCA)
  ✘ Find and fix the reachable vulnerabilities in your  
OSS dependencies.                                                      
                                                                       
💎 Get started with all Semgrep products via `semgrep      
login`.                                                             
✨ Learn more at https://sg.run/cloud.                   
                                                                       
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:04                                                                       
                   
                   
┌─────────────────┐
│ 2 Code Findings │
└─────────────────┘
                                                    
    supabase\functions\ceria\index.ts
     ❱ javascript.lang.security.audit.unsafe-formatstring.unsafe-
       formatstring                                              
          ❰❰ Blocking ❱❱
          Detected string concatenation with a non-literal 
          variable in a util.format / console.log function.
          If an attacker injects a format specifier in the 
          string, it will forge the log message. Try to use
          constant values for the format string.           
          Details: https://sg.run/7Y5R                     
                                                           
          152┆ if (error) console.error(`[ceria] error
               guardando mensaje (${role}):`, error); 
                                                    
    supabase\functions\ceria\tools.ts
     ❱ javascript.lang.security.audit.unsafe-formatstring.unsafe-
       formatstring                                              
          ❰❰ Blocking ❱❱
          Detected string concatenation with a non-literal 
          variable in a util.format / console.log function.
          If an attacker injects a format specifier in the 
          string, it will forge the log message. Try to use
          constant values for the format string.           
          Details: https://sg.run/7Y5R                     
                                                           
          220┆ console.log(`[ceria tool] ${toolName}`,
               JSON.stringify(args));                 

                
                
┌──────────────┐
│ Scan Summary │
└──────────────┘
✅ Scan completed successfully.
 • Findings: 2 (2 blocking)
 • Rules run: 210
 • Targets scanned: 124
 • Parsed lines: ~100.0%
 • Scan was limited to files tracked by git
 • For a detailed list of skipped files and lines, run semgrep with the --verbose flag
Ran 210 rules on 124 files: 2 findings.
💎 Missed out on 1856 pro rules since you aren't logged in!
⚡ Supercharge Semgrep OSS when you create a free account at https://sg.run/rules.


Semgrep findings aceptados:

1. index.ts:152
   Regla: unsafe-formatstring
   Motivo: role solo admite valores literales controlados por código.

2. tools.ts:220
   Regla: unsafe-formatstring
   Motivo: toolName procede del conjunto cerrado de herramientas
   definido por la aplicación.
________________________________________________________
PS **C:\Users\lokur\Documents**\motiv-produccion-v3> npm audit
found 0 vulnerabilities

PS **\motiv-produccion-v3\frontend> npm audit
found 0 vulnerabilities
