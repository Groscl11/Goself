import { useState, FormEvent } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { CouponCodeManager } from './CouponCodeManager';

interface RewardFormProps {
  reward?: any;
  brands: any[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export function RewardForm({ reward, brands, onSubmit, onCancel }: RewardFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand_id: reward?.brand_id || '',
    title: reward?.title || '',
    description: reward?.description || '',
    terms_conditions: reward?.terms_conditions || '',
    value_description: reward?.value_description || '',
    image_url: reward?.image_url || '',
    category: reward?.category || 'general',
    status: reward?.status || 'active',
    is_marketplace: reward?.is_marketplace ?? true,
    coupon_type: reward?.coupon_type || 'unique',
    generic_coupon_code: reward?.generic_coupon_code || '',
    redemption_link: reward?.redemption_link || '',
    reward_type: reward?.reward_type || 'other',
    discount_value: reward?.discount_value || '',
    max_discount_value: reward?.max_discount_value || '',
    currency: reward?.currency || 'USD',
    min_purchase_amount: reward?.min_purchase_amount || '',
    expiry_date: reward?.expiry_date
      ? new Date(reward.expiry_date).toISOString().split('T')[0]
      : '',
  });

  const [uniqueCouponCodes, setUniqueCouponCodes] = useState<string[]>([]);

  const categories = [
    'general',
    'dining',
    'travel',
    'fitness',
    'wellness',
    'electronics',
    'entertainment',
    'fashion',
    'groceries',
  ];

  const rewardTypes = [
    { value: 'flat_discount', label: 'Flat Discount' },
    { value: 'percentage_discount', label: 'Percentage Discount' },
    { value: 'upto_discount', label: 'Upto Discount' },
    { value: 'fixed_value', label: 'Fixed Value' },
    { value: 'free_item', label: 'Free Item' },
    { value: 'other', label: 'Other' },
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        discount_value: formData.discount_value ? parseFloat(formData.discount_value) : null,
        max_discount_value: formData.max_discount_value
          ? parseFloat(formData.max_discount_value)
          : null,
        min_purchase_amount: formData.min_purchase_amount
          ? parseFloat(formData.min_purchase_amount)
          : null,
        unique_coupon_codes: formData.coupon_type === 'unique' ? uniqueCouponCodes : null,
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {reward ? 'Edit Reward' : 'Add New Reward'}
            </h2>
            <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>

                {reward && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reward ID
                    </label>
                    <input
                      type="text"
                      value={reward.reward_id || 'Auto-generated'}
                      disabled
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand *
                  </label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => handleChange('brand_id', e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 50% Off Fine Dining"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    required
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the reward..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleChange('category', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => handleChange('image_url', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Reward Type & Value</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reward Type *
                  </label>
                  <select
                    value={formData.reward_type}
                    onChange={(e) => handleChange('reward_type', e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {rewardTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(formData.reward_type === 'flat_discount' ||
                  formData.reward_type === 'percentage_discount' ||
                  formData.reward_type === 'upto_discount' ||
                  formData.reward_type === 'fixed_value') && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {formData.reward_type === 'percentage_discount'
                            ? 'Discount Percentage'
                            : 'Discount Value'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.discount_value}
                          onChange={(e) => handleChange('discount_value', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={
                            formData.reward_type === 'percentage_discount' ? '20' : '50.00'
                          }
                        />
                      </div>

                      {formData.reward_type !== 'percentage_discount' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Currency
                          </label>
                          <select
                            value={formData.currency}
                            onChange={(e) => handleChange('currency', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {currencies.map((curr) => (
                              <option key={curr} value={curr}>
                                {curr}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {(formData.reward_type === 'percentage_discount' ||
                      formData.reward_type === 'upto_discount') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Discount Value
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={formData.max_discount_value}
                            onChange={(e) => handleChange('max_discount_value', e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="100.00"
                          />
                          <select
                            value={formData.currency}
                            onChange={(e) => handleChange('currency', e.target.value)}
                            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {currencies.map((curr) => (
                              <option key={curr} value={curr}>
                                {curr}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Purchase Amount
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.min_purchase_amount}
                          onChange={(e) => handleChange('min_purchase_amount', e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                        <select
                          value={formData.currency}
                          onChange={(e) => handleChange('currency', e.target.value)}
                          className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {currencies.map((curr) => (
                            <option key={curr} value={curr}>
                              {curr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value Description
                  </label>
                  <input
                    type="text"
                    value={formData.value_description}
                    onChange={(e) => handleChange('value_description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., $50 value or 20% off"
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Redemption Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Redemption Link *
                  </label>
                  <input
                    type="url"
                    value={formData.redemption_link}
                    onChange={(e) => handleChange('redemption_link', e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://brand.com/redeem"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    URL where users will be redirected to redeem the reward
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coupon Type *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="unique"
                        checked={formData.coupon_type === 'unique'}
                        onChange={(e) => handleChange('coupon_type', e.target.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Unique Codes
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value="generic"
                        checked={formData.coupon_type === 'generic'}
                        onChange={(e) => handleChange('coupon_type', e.target.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Generic Code
                      </span>
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formData.coupon_type === 'unique'
                      ? 'Each member gets a unique coupon code'
                      : 'All members use the same coupon code'}
                  </p>
                </div>
              </div>
            </Card>

            <CouponCodeManager
              couponType={formData.coupon_type as 'unique' | 'generic'}
              genericCode={formData.generic_coupon_code}
              uniqueCodes={uniqueCouponCodes}
              onGenericCodeChange={(code) => handleChange('generic_coupon_code', code)}
              onUniqueCodesChange={setUniqueCouponCodes}
            />

            <Card>
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold">Additional Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    value={formData.terms_conditions}
                    onChange={(e) => handleChange('terms_conditions', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Terms and conditions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => handleChange('expiry_date', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_marketplace"
                    checked={formData.is_marketplace}
                    onChange={(e) => handleChange('is_marketplace', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_marketplace" className="text-sm font-medium text-gray-700">
                    Available in Marketplace
                  </label>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : reward ? 'Update Reward' : 'Create Reward'}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
