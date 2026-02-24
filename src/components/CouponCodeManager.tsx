import { useState } from 'react';
import { Plus, Trash2, Upload, Copy, Check } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface CouponCodeManagerProps {
  couponType: 'unique' | 'generic';
  genericCode?: string;
  uniqueCodes: string[];
  onGenericCodeChange: (code: string) => void;
  onUniqueCodesChange: (codes: string[]) => void;
}

export function CouponCodeManager({
  couponType,
  genericCode = '',
  uniqueCodes,
  onGenericCodeChange,
  onUniqueCodesChange,
}: CouponCodeManagerProps) {
  const [newCode, setNewCode] = useState('');
  const [bulkCodes, setBulkCodes] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleAddCode = () => {
    if (newCode.trim()) {
      onUniqueCodesChange([...uniqueCodes, newCode.trim()]);
      setNewCode('');
    }
  };

  const handleRemoveCode = (index: number) => {
    onUniqueCodesChange(uniqueCodes.filter((_, i) => i !== index));
  };

  const handleBulkUpload = () => {
    const codes = bulkCodes
      .split('\n')
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    if (codes.length > 0) {
      onUniqueCodesChange([...uniqueCodes, ...codes]);
      setBulkCodes('');
    }
  };

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (couponType === 'generic') {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Generic Coupon Code</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coupon Code *
            </label>
            <input
              type="text"
              required
              value={genericCode}
              onChange={(e) => onGenericCodeChange(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              placeholder="SAVE20"
            />
            <p className="text-sm text-gray-500 mt-1">
              This single code will be used by all members for redemption
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Unique Coupon Codes</h3>
          <p className="text-sm text-gray-600 mb-4">
            Add individual unique codes or upload multiple codes at once. Each member will receive a unique code.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Single Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCode()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              placeholder="UNIQUE-CODE-123"
            />
            <Button type="button" onClick={handleAddCode}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bulk Upload Codes
          </label>
          <textarea
            value={bulkCodes}
            onChange={(e) => setBulkCodes(e.target.value)}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Enter one code per line:&#10;CODE-001&#10;CODE-002&#10;CODE-003"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-gray-500">
              Paste codes separated by new lines
            </p>
            <Button type="button" onClick={handleBulkUpload} variant="secondary">
              <Upload className="w-4 h-4 mr-2" />
              Upload Codes
            </Button>
          </div>
        </div>

        {uniqueCodes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Uploaded Codes ({uniqueCodes.length})
              </label>
            </div>
            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
              <div className="divide-y divide-gray-200">
                {uniqueCodes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="font-mono text-sm text-gray-900">{code}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(code, index)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Copy code"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCode(index)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {uniqueCodes.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No codes uploaded yet</p>
            <p className="text-xs text-gray-400 mt-1">Add codes using the inputs above</p>
          </div>
        )}
      </div>
    </Card>
  );
}
