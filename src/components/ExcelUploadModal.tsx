import { useState } from 'react';
import { X, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

interface ExcelUploadModalProps {
  onClose: () => void;
  onUpload: (data: any[]) => Promise<void>;
}

export function ExcelUploadModal({ onClose, onUpload }: ExcelUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const downloadTemplate = () => {
    const template = [
      {
        brand_name: 'Example Brand',
        title: '50% Off Dining',
        description: 'Get 50% off at participating restaurants',
        category: 'dining',
        reward_type: 'percentage_discount',
        discount_value: 50,
        max_discount_value: 100,
        min_purchase_amount: 50,
        currency: 'USD',
        coupon_type: 'generic',
        generic_coupon_code: 'SAVE50',
        redemption_link: 'https://example.com/redeem',
        value_description: '50% off up to $100',
        terms_conditions: 'Valid for 30 days',
        expiry_date: '2024-12-31',
        is_marketplace: 'TRUE',
        status: 'active',
      },
      {
        brand_name: 'Example Brand',
        title: '$20 Off Purchase',
        description: 'Get $20 off your next purchase',
        category: 'general',
        reward_type: 'flat_discount',
        discount_value: 20,
        max_discount_value: '',
        min_purchase_amount: 100,
        currency: 'USD',
        coupon_type: 'unique',
        generic_coupon_code: '',
        redemption_link: 'https://example.com/redeem',
        value_description: '$20 off',
        terms_conditions: 'Valid for 30 days',
        expiry_date: '2024-12-31',
        is_marketplace: 'TRUE',
        status: 'active',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rewards Template');

    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 40 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 25 },
      { wch: 30 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.writeFile(workbook, 'rewards_upload_template.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError('The Excel file is empty');
        return;
      }

      setPreview(jsonData.slice(0, 5));
    } catch (err) {
      setError('Failed to read Excel file. Please check the format.');
      console.error(err);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedData = jsonData.map((row: any) => ({
        brand_name: row.brand_name,
        title: row.title,
        description: row.description,
        category: row.category || 'general',
        reward_type: row.reward_type || 'other',
        discount_value: row.discount_value ? parseFloat(row.discount_value) : null,
        max_discount_value: row.max_discount_value ? parseFloat(row.max_discount_value) : null,
        min_purchase_amount: row.min_purchase_amount ? parseFloat(row.min_purchase_amount) : null,
        currency: row.currency || 'USD',
        coupon_type: row.coupon_type || 'unique',
        generic_coupon_code: row.generic_coupon_code || '',
        redemption_link: row.redemption_link || '',
        value_description: row.value_description || '',
        terms_conditions: row.terms_conditions || '',
        expiry_date: row.expiry_date || null,
        is_marketplace: row.is_marketplace === 'TRUE' || row.is_marketplace === true,
        status: row.status || 'draft',
      }));

      await onUpload(processedData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload rewards. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Upload Rewards via Excel</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <Card>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Step 1: Download Template</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download the Excel template with sample data and column headers
                </p>
                <Button onClick={downloadTemplate} variant="secondary">
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-3">Step 2: Upload Your File</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Fill in the template with your reward data and upload it here
                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label
                    htmlFor="excel-upload"
                    className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Choose Excel File
                  </label>
                  {file && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      {file.name}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">Upload Error</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {preview.length > 0 && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-3">Preview (First 5 rows)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">
                            Brand
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">
                            Title
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">
                            Type
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">
                            Discount
                          </th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row: any, index) => (
                          <tr key={index} className="border-t border-gray-100">
                            <td className="py-2 px-3">{row.brand_name}</td>
                            <td className="py-2 px-3">{row.title}</td>
                            <td className="py-2 px-3">{row.reward_type}</td>
                            <td className="py-2 px-3">{row.discount_value || '-'}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Important Notes:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Brand name must match existing brands in the system</li>
                  <li>• Valid reward types: flat_discount, percentage_discount, upto_discount, fixed_value, free_item, other</li>
                  <li>• Valid coupon types: unique, generic</li>
                  <li>• Valid categories: general, dining, travel, fitness, wellness, electronics, entertainment, fashion, groceries</li>
                  <li>• Valid statuses: draft, pending, active, inactive, expired</li>
                  <li>• is_marketplace must be TRUE or FALSE</li>
                  <li>• Dates should be in YYYY-MM-DD format</li>
                </ul>
              </div>
            </div>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload Rewards'}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
