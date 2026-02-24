import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from './ui/Button';

interface RuleCondition {
  id: string;
  type: string;
  operator: string;
  value: any;
  subConditions?: RuleCondition[];
}

interface RuleBuilderProps {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
  conditionTypes: Array<{
    value: string;
    label: string;
    operators: Array<{ value: string; label: string }>;
    inputType: 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'time';
    options?: Array<{ value: string; label: string }>;
    hint?: string;
    requiredScope?: string;
  }>;
  availableScopes?: string[];
}

export function RuleBuilder({ conditions, onChange, conditionTypes, availableScopes = [] }: RuleBuilderProps) {
  const addCondition = () => {
    const newCondition: RuleCondition = {
      id: `cond_${Date.now()}`,
      type: conditionTypes[0]?.value || '',
      operator: conditionTypes[0]?.operators[0]?.value || '',
      value: '',
    };
    onChange([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, field: keyof RuleCondition, value: any) => {
    onChange(
      conditions.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const updateConditionType = (id: string, newTypeValue: string) => {
    const newType = conditionTypes.find(ct => ct.value === newTypeValue);
    onChange(
      conditions.map(c =>
        c.id === id
          ? {
              ...c,
              type: newTypeValue,
              operator: newType?.operators[0]?.value || '',
              value: '',
            }
          : c
      )
    );
  };

  const getConditionType = (type: string) => {
    return conditionTypes.find(ct => ct.value === type);
  };

  const isScopeAvailable = (scope?: string) => {
    if (!scope) return true;
    return availableScopes.includes(scope);
  };

  return (
    <div className="space-y-3">
      {conditions.map((condition, index) => {
        const conditionType = getConditionType(condition.type);
        const scopeAvailable = isScopeAvailable(conditionType?.requiredScope);

        return (
          <div
            key={condition.id}
            className={`border rounded-lg p-4 ${
              scopeAvailable ? 'border-gray-300' : 'border-orange-300 bg-orange-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <select
                    value={condition.type}
                    onChange={(e) => updateConditionType(condition.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {conditionTypes.map(ct => (
                      <option key={ct.value} value={ct.value}>
                        {ct.label}
                      </option>
                    ))}
                  </select>
                  {conditionType?.hint && (
                    <p className="text-xs text-gray-500 mt-1">{conditionType.hint}</p>
                  )}
                </div>

                <div>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    disabled={!scopeAvailable}
                  >
                    {conditionType?.operators.map(op => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {conditionType?.inputType === 'select' && conditionType.options ? (
                    <select
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={!scopeAvailable}
                    >
                      <option value="">Select...</option>
                      {conditionType.options.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : conditionType?.inputType === 'number' ? (
                    <input
                      type="number"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Enter value"
                      disabled={!scopeAvailable}
                    />
                  ) : conditionType?.inputType === 'date' ? (
                    <input
                      type="date"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={!scopeAvailable}
                    />
                  ) : conditionType?.inputType === 'time' ? (
                    <input
                      type="time"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      disabled={!scopeAvailable}
                    />
                  ) : (
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Enter value"
                      disabled={!scopeAvailable}
                    />
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeCondition(condition.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {!scopeAvailable && conditionType?.requiredScope && (
              <div className="mt-2 flex items-start gap-2 text-xs text-orange-700 bg-orange-100 p-2 rounded">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  Requires additional Shopify permission: <code className="font-mono font-semibold">{conditionType.requiredScope}</code>
                </span>
              </div>
            )}

            {index < conditions.length - 1 && (
              <div className="mt-3 text-center text-xs font-medium text-gray-500">AND</div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addCondition}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Condition
      </Button>
    </div>
  );
}
