import React, { useState, useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle, X, Info, Download, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface UploadResult {
  success: boolean;
  message: string;
  details?: {
    processed: number;
    success: number;
    failed: number;
    batchId: string;
    duration: number;
    usersCreated: number;
    usersUpdated: number;
  };
  errors?: string[];
}

export function UploadCSV() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setResult({
        success: false,
        message: 'Por favor, seleccione un archivo CSV válido.',
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setProgress(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };

  const parseTimestamp = (timestampStr: string): Date | null => {
    try {
      // Limpiar el string de timestamp
      const cleanStr = timestampStr.replace(/\s+/g, ' ').trim();
      
      // Intentar varios formatos de fecha
      const formats = [
        // Formato con AM/PM: "24/06/2025 8:43:12 a. m."
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(a\.|p\.)\s*m\./i,
        // Formato sin AM/PM: "24/06/2025 8:43:12"
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/,
        // Formato ISO: "2025-06-24 08:43:12"
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/
      ];

      for (const format of formats) {
        const match = cleanStr.match(format);
        if (match) {
          if (format === formats[0]) {
            // Formato con AM/PM
            const [, day, month, year, hour, minute, second, period] = match;
            let hour24 = parseInt(hour);
            
            if (period.toLowerCase().includes('p') && hour24 !== 12) {
              hour24 += 12;
            } else if (period.toLowerCase().includes('a') && hour24 === 12) {
              hour24 = 0;
            }
            
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minute), parseInt(second));
          } else if (format === formats[1]) {
            // Formato DD/MM/YYYY
            const [, day, month, year, hour, minute, second] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
          } else if (format === formats[2]) {
            // Formato ISO YYYY-MM-DD
            const [, year, month, day, hour, minute, second] = match;
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
          }
        }
      }
      
      // Si no coincide con ningún formato, intentar Date.parse
      const parsed = new Date(cleanStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing timestamp:', timestampStr, error);
      return null;
    }
  };

  const processCSV = async (csvContent: string): Promise<UploadResult> => {
    const startTime = Date.now();
    let usersCreated = 0;
    let usersUpdated = 0;

    try {
      console.log('🚀 Iniciando procesamiento de CSV...');
      
      // Limpiar y dividir el contenido
      const lines = csvContent
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      console.log(`📊 Total de líneas encontradas: ${lines.length}`);

      if (lines.length < 1) {
        return {
          success: false,
          message: 'El archivo CSV está vacío o no tiene datos válidos.',
        };
      }

      // Detectar si hay header
      const firstLine = parseCSVLine(lines[0]);
      const hasHeader = firstLine[0]?.toLowerCase().includes('cuenta') || 
                       firstLine[0]?.toLowerCase().includes('id') ||
                       firstLine.length > 8; // Si tiene muchas columnas, probablemente es header
      
      const dataLines = hasHeader ? lines.slice(1) : lines;
      console.log(`📋 Líneas de datos a procesar: ${dataLines.length} (Header detectado: ${hasHeader})`);

      if (dataLines.length === 0) {
        return {
          success: false,
          message: 'No se encontraron datos para procesar en el archivo CSV.',
        };
      }

      let processed = 0;
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      const batchId = crypto.randomUUID();

      console.log(`🔄 Iniciando procesamiento con batch ID: ${batchId}`);

      // Procesar líneas en lotes para mejor rendimiento
      for (const line of dataLines) {
        processed++;
        
        // Actualizar progreso
        const progressPercent = Math.round((processed / dataLines.length) * 100);
        setProgress(progressPercent);
        
        try {
          const values = parseCSVLine(line);
          
          if (values.length < 3) {
            failed++;
            errors.push(`Línea ${processed}: Datos insuficientes (${values.length} columnas)`);
            continue;
          }

          // Extraer datos básicos
          const userId = values[0]?.trim();
          const accountStatus = values[1]?.trim() || 'Normal';
          
          if (!userId) {
            failed++;
            errors.push(`Línea ${processed}: ID de usuario vacío`);
            continue;
          }

          // Función helper para parsear números
          const parseNumber = (value: string | undefined): number => {
            if (!value || value.trim() === '') return 0;
            const cleaned = value.trim().replace(/[^\d.-]/g, '');
            const num = parseInt(cleaned);
            return isNaN(num) ? 0 : Math.max(0, num);
          };

          // Extraer valores numéricos
          const printTotal = parseNumber(values[2]);
          const printColor = parseNumber(values[3]);
          const printMono = Math.max(0, printTotal - printColor);
          
          // Intentar extraer más columnas si están disponibles
          let copyTotal = 0, copyColor = 0, scanTotal = 0, faxTotal = 0;
          
          if (values.length > 4) {
            copyTotal = parseNumber(values[4]);
            if (values.length > 5) copyColor = parseNumber(values[5]);
            if (values.length > 6) scanTotal = parseNumber(values[6]);
            if (values.length > 7) faxTotal = parseNumber(values[7]);
          }
          
          const copyMono = Math.max(0, copyTotal - copyColor);

          // Extraer timestamp (última columna)
          const timestampStr = values[values.length - 1]?.trim();
          const reportTimestamp = parseTimestamp(timestampStr);

          if (!reportTimestamp || isNaN(reportTimestamp.getTime())) {
            failed++;
            errors.push(`Línea ${processed}: Timestamp inválido: ${timestampStr}`);
            continue;
          }

          console.log(`✅ Procesando usuario ${userId}: prints=${printTotal}, copies=${copyTotal}, scans=${scanTotal}`);

          // 1. UPSERT INTELIGENTE DE USUARIO - PRESERVAR DATOS EXISTENTES
          // Primero verificar si el usuario ya existe
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, full_name, email, office, department')
            .eq('id', userId)
            .single();

          // Preparar datos para upsert - solo actualizar campos vacíos
          const userUpdateData: any = {
            id: userId,
            status: accountStatus,
            updated_at: new Date().toISOString(),
          };

          // REGLA CRÍTICA: Solo actualizar si el campo está vacío o es null
          if (!existingUser) {
            // Usuario nuevo - se puede crear sin datos adicionales
            console.log(`👤 Creando nuevo usuario: ${userId}`);
            usersCreated++;
          } else {
            // Usuario existente - PRESERVAR datos establecidos
            console.log(`🔄 Actualizando usuario existente: ${userId} (preservando datos personales)`);
            usersUpdated++;
            
            // NO actualizar full_name, email, office, department si ya existen
            // Solo actualizar status y updated_at
          }

          const { error: userError } = await supabase
            .from('users')
            .upsert(userUpdateData, {
              onConflict: 'id'
            });

          if (userError) {
            console.error('❌ Error upserting user:', userError);
            failed++;
            errors.push(`Línea ${processed}: Error usuario: ${userError.message}`);
            continue;
          }

          // 2. Insertar datos raw (siempre se insertan nuevos)
          const { error: rawError } = await supabase
            .from('prints_raw')
            .insert({
              user_id: userId,
              report_timestamp: reportTimestamp.toISOString(),
              account_status: accountStatus,
              print_total: printTotal,
              print_color: printColor,
              print_mono: printMono,
              copy_total: copyTotal,
              copy_color: copyColor,
              copy_mono: copyMono,
              scan_total: scanTotal,
              fax_total: faxTotal,
              import_batch_id: batchId,
            });

          if (rawError) {
            console.error('❌ Error inserting raw data:', rawError);
            failed++;
            errors.push(`Línea ${processed}: Error datos raw: ${rawError.message}`);
            continue;
          }

          // 3. Actualizar datos mensuales (siempre se actualizan con los últimos valores)
          const year = reportTimestamp.getFullYear();
          const month = reportTimestamp.getMonth() + 1;

          // Obtener datos del mes anterior para diferencias
          const { data: prevMonthData } = await supabase
            .from('prints_monthly')
            .select('print_total, copy_total, scan_total, fax_total')
            .eq('user_id', userId)
            .eq('year', month === 1 ? year - 1 : year)
            .eq('month', month === 1 ? 12 : month - 1);

          const prevMonth = prevMonthData && prevMonthData.length > 0 ? prevMonthData[0] : null;

          const printDiff = prevMonth ? printTotal - prevMonth.print_total : printTotal;
          const copyDiff = prevMonth ? copyTotal - prevMonth.copy_total : copyTotal;
          const scanDiff = prevMonth ? scanTotal - prevMonth.scan_total : scanTotal;
          const faxDiff = prevMonth ? faxTotal - prevMonth.fax_total : faxTotal;

          const { error: monthlyError } = await supabase
            .from('prints_monthly')
            .upsert({
              user_id: userId,
              year,
              month,
              print_total: printTotal,
              print_color: printColor,
              print_mono: printMono,
              copy_total: copyTotal,
              copy_color: copyColor,
              copy_mono: copyMono,
              scan_total: scanTotal,
              fax_total: faxTotal,
              print_total_diff: printDiff,
              copy_total_diff: copyDiff,
              scan_total_diff: scanDiff,
              fax_total_diff: faxDiff,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id,year,month'
            });

          if (monthlyError) {
            console.error('❌ Error upserting monthly data:', monthlyError);
            failed++;
            errors.push(`Línea ${processed}: Error datos mensuales: ${monthlyError.message}`);
            continue;
          }

          success++;
          
          // Log progreso cada 10 registros
          if (processed % 10 === 0) {
            console.log(`📈 Progreso: ${processed}/${dataLines.length} (${success} exitosos, ${failed} fallidos)`);
          }

        } catch (error) {
          console.error('💥 Error inesperado procesando línea:', error);
          failed++;
          errors.push(`Línea ${processed}: Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🏁 Procesamiento completado: ${success} exitosos, ${failed} fallidos de ${processed} total en ${duration}ms`);

      // 4. Registrar en log de importación
      try {
        const { error: logError } = await supabase
          .from('import_log')
          .insert({
            file_name: file?.name || 'unknown.csv',
            batch_id: batchId,
            rows_processed: processed,
            rows_success: success,
            rows_failed: failed,
            error_details: errors.length > 0 ? { errors: errors.slice(0, 20) } : null,
            imported_by: user?.id,
          });

        if (logError) {
          console.error('⚠️ Error logging import:', logError);
        }
      } catch (logError) {
        console.error('⚠️ Error en log de importación:', logError);
      }

      return {
        success: success > 0,
        message: success > 0 
          ? `🎉 ¡Importación completada exitosamente! ${success} de ${processed} registros procesados. Los datos personales existentes se preservaron automáticamente.`
          : `❌ No se pudieron procesar los registros. Revise el formato del archivo.`,
        details: { 
          processed, 
          success, 
          failed, 
          batchId, 
          duration: Math.round(duration / 1000),
          usersCreated,
          usersUpdated
        },
        errors: errors.slice(0, 10), // Mostrar solo los primeros 10 errores
      };

    } catch (error) {
      console.error('💥 Error crítico procesando CSV:', error);
      return {
        success: false,
        message: `Error crítico al procesar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      };
    }
  };

  const handleUpload = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!file) {
      setResult({
        success: false,
        message: 'Por favor, seleccione un archivo CSV primero.',
      });
      return;
    }

    if (!user) {
      setResult({
        success: false,
        message: 'Debe estar autenticado para subir archivos.',
      });
      return;
    }

    console.log('🚀 Iniciando subida de archivo:', file.name);
    setUploading(true);
    setResult(null);
    setProgress(0);

    try {
      const text = await file.text();
      console.log('📖 Archivo leído exitosamente, iniciando procesamiento...');
      const result = await processCSV(text);
      setResult(result);
      setProgress(100);
    } catch (error) {
      console.error('💥 Error al leer archivo:', error);
      setResult({
        success: false,
        message: `Error al leer el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectFile = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    fileInputRef.current?.click();
  };

  const downloadSampleCSV = () => {
    const sampleData = `ID de la cuenta;Estado de la cuenta;Imprimir (total);Imprimir (a todo color);Copiar (total);Copiar (a todo color);Escanear (total);Fax (total);Marca de tiempo
0001;Normal;150;45;75;20;30;5;15/12/2024 10:30:00 a. m.
0002;Normal;200;80;100;35;45;8;15/12/2024 10:30:00 a. m.
0003;Normal;95;25;50;15;20;2;15/12/2024 10:30:00 a. m.
0004;Normal;300;120;150;60;80;12;15/12/2024 10:30:00 a. m.
0005;Normal;180;70;90;30;40;6;15/12/2024 10:30:00 a. m.`;

    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ejemplo_impresiones.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Subir Archivo CSV
          </h2>
          <p className="text-gray-600">
            Seleccione el archivo CSV con los datos de conteos de impresión mensual.
          </p>
        </div>

        {/* Upload Area */}
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleInputChange}
            className="hidden"
          />

          {!file ? (
            <div>
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-gray-600 mb-4">
                o haz clic para seleccionar un archivo
              </p>
              <button
                type="button"
                onClick={handleSelectFile}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Seleccionar Archivo
              </button>
            </div>
          ) : (
            <div>
              <File className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {file.name}
              </p>
              <p className="text-gray-600 mb-4">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              
              {/* Progress Bar */}
              {uploading && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Procesando...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center space-x-3">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Subir e Importar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={uploading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className={`
            mt-6 p-6 rounded-lg border-2
            ${result.success 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
            }
          `}>
            <div className="flex items-start">
              {result.success ? (
                <CheckCircle className="h-6 w-6 text-green-600 mt-0.5 mr-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600 mt-0.5 mr-4 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-lg font-semibold mb-3 ${
                  result.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.message}
                </p>
                
                {result.details && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center">
                        <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Procesados</p>
                          <p className="text-xl font-bold text-gray-900">{result.details.processed}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Exitosos</p>
                          <p className="text-xl font-bold text-green-700">{result.details.success}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center">
                        <X className="h-5 w-5 text-red-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Fallidos</p>
                          <p className="text-xl font-bold text-red-700">{result.details.failed}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-purple-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-600">Duración</p>
                          <p className="text-xl font-bold text-purple-700">{result.details.duration}s</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {result.details && (
                  <div className="bg-white p-4 rounded-lg border mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Resumen de Usuarios:</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Usuarios nuevos creados:</span>
                        <span className="font-semibold text-blue-600 ml-2">{result.details.usersCreated}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Usuarios existentes actualizados:</span>
                        <span className="font-semibold text-green-600 ml-2">{result.details.usersUpdated}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      ID de lote: <code className="bg-gray-100 px-1 rounded">{result.details.batchId.slice(0, 8)}...</code>
                    </p>
                  </div>
                )}

                {result.errors && result.errors.length > 0 && (
                  <div className="bg-red-100 rounded-lg p-4 border border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      Primeros errores encontrados:
                    </p>
                    <div className="max-h-32 overflow-y-auto">
                      <ul className="text-xs text-red-700 space-y-1">
                        {result.errors.map((error, index) => (
                          <li key={index} className="font-mono bg-red-50 p-1 rounded">• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {result.success && (
                  <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>✅ ¡Importación exitosa!</strong> Los datos se han actualizado en el sistema. 
                      Puede ver los resultados en el Dashboard o en la sección de Usuarios.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Formato Esperado del CSV
              </h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Estructura requerida:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Delimitador: punto y coma (;)</li>
                      <li>Codificación: UTF-8 o latin-1</li>
                      <li>Columna 1: ID de la cuenta</li>
                      <li>Columna 2: Estado de la cuenta</li>
                      <li>Columna 3: Total de impresiones</li>
                      <li>Columna 4: Impresiones a color</li>
                      <li>Última columna: Marca de tiempo</li>
                    </ul>
                  </div>
                  <div>
                    <p><strong>Formatos de fecha aceptados:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>DD/MM/YYYY HH:MM:SS a.m./p.m.</li>
                      <li>DD/MM/YYYY HH:MM:SS</li>
                      <li>YYYY-MM-DD HH:MM:SS</li>
                    </ul>
                    <p className="mt-2"><strong>Notas importantes:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Campos vacíos = 0</li>
                      <li>Se crean usuarios automáticamente</li>
                      <li>Datos se agregan por mes</li>
                      <li><strong>🔒 Los nombres, emails y oficinas NO se modifican</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Preservation Notice */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                🔒 Protección de Datos Personales
              </h4>
              <p className="text-sm text-blue-700">
                <strong>Los datos personales establecidos se preservan automáticamente:</strong>
              </p>
              <ul className="text-sm text-blue-700 list-disc list-inside mt-2 space-y-1">
                <li><strong>Nombre Completo:</strong> No se modifica si ya está definido</li>
                <li><strong>Email:</strong> Se mantiene el email asignado</li>
                <li><strong>Oficina:</strong> La oficina asignada no cambia</li>
                <li><strong>Departamento:</strong> Se preserva la clasificación</li>
                <li><strong>Solo se actualizan:</strong> Conteos de impresiones, copias, escaneos y fax</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Sample CSV Download */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <File className="h-5 w-5 text-gray-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Archivo CSV de Ejemplo
                </h4>
                <p className="text-sm text-gray-700">
                  Descargue un archivo CSV de ejemplo con el formato correcto para probar la importación.
                </p>
              </div>
            </div>
            <button
              onClick={downloadSampleCSV}
              className="inline-flex items-center px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Ejemplo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}