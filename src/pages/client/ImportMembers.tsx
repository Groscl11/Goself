import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Upload, Download, ArrowLeft, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { clientMenuItems } from './clientMenuItems';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; email: string; error: string }[];
}

export function ImportMembers() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        email: 'john.doe@example.com',
        full_name: 'John Doe',
        phone: '+1 (555) 123-4567',
        external_id: 'EXT001',
      },
      {
        email: 'jane.smith@example.com',
        full_name: 'Jane Smith',
        phone: '+1 (555) 987-6543',
        external_id: 'EXT002',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');

    ws['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
    ];

    XLSX.writeFile(wb, 'members_template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single();

      if (!profile?.client_id) throw new Error('Client ID not found');

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const result: ImportResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rowNumber = i + 2;

        try {
          if (!row.email || !row.full_name) {
            result.failed++;
            result.errors.push({
              row: rowNumber,
              email: row.email || 'N/A',
              error: 'Email and full name are required',
            });
            continue;
          }

          const { data: existing } = await supabase
            .from('member_users')
            .select('id')
            .eq('client_id', profile.client_id)
            .eq('email', row.email)
            .maybeSingle();

          if (existing) {
            result.failed++;
            result.errors.push({
              row: rowNumber,
              email: row.email,
              error: 'Member with this email already exists',
            });
            continue;
          }

          const { data: newMember, error: insertError } = await supabase
            .from('member_users')
            .insert([{
              client_id: profile.client_id,
              email: row.email,
              full_name: row.full_name,
              phone: row.phone || '',
              external_id: row.external_id || '',
              is_active: true,
              metadata: {},
            }])
            .select()
            .single();

          if (insertError) throw insertError;

          if (newMember) {
            await supabase
              .from('member_sources')
              .insert([{
                member_id: newMember.id,
                source_type: 'import',
                source_details: {
                  filename: file.name,
                  imported_by: 'client_portal',
                  row_number: rowNumber
                },
              }]);
          }

          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            email: row.email,
            error: error.message || 'Unknown error',
          });
        }
      }

      setImportResult(result);
    } catch (error: any) {
      console.error('Error importing members:', error);
      alert(error.message || 'Failed to import members');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout menuItems={clientMenuItems} title="Import Members">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/client/members')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Members
          </Button>
        </div>

        <Card>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Members</h2>
            <p className="text-gray-600 mb-6">
              Upload an Excel file to import multiple members at once
            </p>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Download the template file below</li>
                  <li>Fill in member details (email and full_name are required)</li>
                  <li>Upload the completed file</li>
                  <li>Review the import results</li>
                </ol>
              </div>

              <div>
                <Button
                  variant="secondary"
                  onClick={downloadTemplate}
                  className="w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center">
                  <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">{file.name}</p>
                      <p className="text-xs text-gray-500 mb-4">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          variant="secondary"
                        >
                          Choose Different File
                        </Button>
                        <Button onClick={handleImport} disabled={loading}>
                          <Upload className="w-4 h-4 mr-2" />
                          {loading ? 'Importing...' : 'Import Members'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Click to select an Excel file (.xlsx, .xls, .csv)
                      </p>
                      <Button onClick={() => fileInputRef.current?.click()}>
                        Select File
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {importResult && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-900">Successful</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {importResult.success}
                      </p>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <span className="font-semibold text-red-900">Failed</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        {importResult.failed}
                      </p>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="border border-red-200 rounded-lg overflow-hidden">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                        <h4 className="font-semibold text-red-900">Import Errors</h4>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                                Row
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                                Email
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                                Error
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {importResult.errors.map((error, index) => (
                              <tr key={index} className="border-b border-gray-100">
                                <td className="px-4 py-2 text-sm text-gray-900">{error.row}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{error.email}</td>
                                <td className="px-4 py-2 text-sm text-red-600">{error.error}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => navigate('/client/members')}
                      className="flex-1"
                    >
                      Go to Members
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFile(null);
                        setImportResult(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Import More
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
