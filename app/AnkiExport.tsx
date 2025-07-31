'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText } from 'lucide-react';

export default function AnkiExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setError('');

    try {
      const response = await fetch('/api/export-anki');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'echolingo_anki_7_days.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Export error:', error);
      setError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="backdrop-blur-md bg-white/80 border-white/20 shadow-xl">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileText className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-xl">Export to Anki</CardTitle>
            <CardDescription>Export your saved words and idioms to Anki-compatible CSV</CardDescription>
          </div>
        </div>
      </CardHeader>
             <CardContent className="space-y-4">
         <div className="flex justify-center">
           <Button
             onClick={handleExport}
             disabled={isExporting}
             className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
           >
             {isExporting ? (
               <div className="flex items-center gap-2">
                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 Exporting...
               </div>
             ) : (
               <div className="flex items-center gap-2">
                 <Download className="h-4 w-4" />
                 Export to Anki
               </div>
             )}
           </Button>
         </div>

         {error && (
           <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
             <p className="text-sm text-red-600">{error}</p>
           </div>
         )}
       </CardContent>
    </Card>
  );
} 