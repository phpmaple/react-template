import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { Button, Form, Progress, Toast } from '@douyinfe/semi-ui';
import { IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { bitable, IFieldMeta, ITableMeta } from "@lark-base-open/js-sdk";
import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

// Provider list
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
];

interface FormValues {
  table: string;
  systemPrompt: string;
  provider: string;
  model: string;
  apiKey: string;
  userPromptFields: string[];
  resultFields: string[];
  temperature?: number;
  topP?: number;
}

interface Model {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export default function App() {
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>([]);
  const [fieldMetaList, setFieldMetaList] = useState<IFieldMeta[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('openrouter');
  const formApi = useRef<BaseFormApi>();

  // Load table list and field list
  useEffect(() => {
    Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()])
      .then(([metaList, selection]) => {
        setTableMetaList(metaList);
        
        // Load saved provider and API key
        const savedProvider = localStorage.getItem('selected_provider') || 'openrouter';
        setCurrentProvider(savedProvider);
        
        // Use setTimeout to ensure form is ready
        setTimeout(() => {
          // Set default values including current table
          const defaultValues: any = {
            provider: savedProvider,
          };
          
          // Set current table as default
          if (selection.tableId) {
            defaultValues.table = selection.tableId;
            // Load field list for the current table
            loadFieldList(selection.tableId);
          }
          
          // Load API key for the selected provider
          const savedApiKey = localStorage.getItem(`${savedProvider}_api_key`);
          if (savedApiKey) {
            defaultValues.apiKey = savedApiKey;
            // Load models if API key exists
            if (savedProvider === 'openrouter') {
              loadModels(savedApiKey);
            }
          }
          
          formApi.current?.setValues(defaultValues);
        }, 100);
      });
  }, []);

  // Load field list when table changes
  const loadFieldList = useCallback(async (tableId: string) => {
    if (!tableId) return;
    try {
      const table = await bitable.base.getTableById(tableId);
      const fieldList = await table.getFieldMetaList();
      setFieldMetaList(fieldList);
    } catch (error) {
      console.error('Failed to load field list:', error);
      Toast.error('Failed to load field list');
    }
  }, []);

  // Load models from OpenRouter
  const loadModels = useCallback(async (apiKey: string) => {
    if (!apiKey) return;
    
    setLoadingModels(true);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      const modelList: Model[] = data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        pricing: model.pricing ? {
          prompt: (parseFloat(model.pricing.prompt) * 1000000).toFixed(2),
          completion: (parseFloat(model.pricing.completion) * 1000000).toFixed(2)
        } : undefined
      }));

      setModels(modelList);
    } catch (error) {
      console.error('Failed to load models:', error);
      Toast.error('Failed to load models. Please check your API key.');
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (values: FormValues) => {
    if (!values.table || !values.userPromptFields?.length || !values.apiKey || !values.systemPrompt) {
      Toast.error('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const table = await bitable.base.getTableById(values.table);
      const records = await table.getRecords({ pageSize: 5000 });
      
      let processedCount = 0;
      const totalCount = records.records.length;

      for (const record of records.records) {
        // Extract and combine text from multiple user prompt fields
        const userPromptTexts: string[] = [];
        
        for (const fieldId of values.userPromptFields) {
          const fieldValue = record.fields[fieldId];
          if (!fieldValue) continue;
          
          let extractedText: string;
          
          // Handle different field formats
          if (typeof fieldValue === 'string') {
            // Try to parse as JSON if it looks like a JSON string
            if (fieldValue.startsWith('[') && fieldValue.endsWith(']')) {
              try {
                const parsed = JSON.parse(fieldValue);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
                  // Extract text from rich text format [{type: "text", text: "content"}]
                  extractedText = parsed.map((item: any) => item.text || '').join('');
                } else {
                  extractedText = fieldValue;
                }
              } catch {
                extractedText = fieldValue;
              }
            } else {
              extractedText = fieldValue;
            }
          } else if (typeof fieldValue === 'object' && fieldValue !== null) {
            // Handle object format
            const fieldObj = fieldValue as any;
            if (Array.isArray(fieldObj)) {
              // Handle array of rich text objects
              extractedText = fieldObj.map((item: any) => item.text || '').join('');
            } else {
              extractedText = fieldObj.text || fieldObj.content || JSON.stringify(fieldValue);
            }
          } else {
            extractedText = String(fieldValue);
          }
          
          if (extractedText.trim()) {
            userPromptTexts.push(extractedText);
          }
        }
        
        // Skip if no user prompt content found
        if (userPromptTexts.length === 0) {
          processedCount++;
          setProgress(Math.round((processedCount / totalCount) * 100));
          continue;
        }
        
        // Combine all user prompts directly
        const userPromptText = userPromptTexts.join('');

        // Check which result fields need to be filled
        const fieldsToUpdate: string[] = [];
        for (const fieldId of values.resultFields) {
          // Check if this field is empty
          const fieldValue = record.fields[fieldId];
          if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
            fieldsToUpdate.push(fieldId);
          }
        }

        // Skip if all result fields already have values
        if (fieldsToUpdate.length === 0) {
          processedCount++;
          setProgress(Math.round((processedCount / totalCount) * 100));
          continue;
        }

        // Process only for empty fields
        const updateFields: any = {};
        for (const fieldId of fieldsToUpdate) {
          try {
            const result = await callOpenRouter(
              values.apiKey,
              values.model,
              values.systemPrompt,
              userPromptText,
              values.temperature,
              values.topP
            );
            updateFields[fieldId] = result;
          } catch (error) {
            console.error(`Failed to process field ${fieldId}:`, error);
            updateFields[fieldId] = `Error: ${error}`;
          }
        }

        if (Object.keys(updateFields).length > 0) {
          await table.setRecord(record.recordId, { fields: updateFields });
        }

        processedCount++;
        setProgress(Math.round((processedCount / totalCount) * 100));
      }

      Toast.success('Processing completed successfully!');
    } catch (error) {
      console.error('Processing failed:', error);
      Toast.error(`Processing failed: ${error}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  // Call OpenRouter API
  const callOpenRouter = async (
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature?: number,
    topP?: number
  ): Promise<string> => {
    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    // Add optional parameters if provided and not zero
    if (temperature !== undefined && temperature !== 0) {
      requestBody.temperature = temperature;
    }
    if (topP !== undefined && topP !== 0) {
      requestBody.top_p = topP;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'Lark Base Plugin'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response';
  };

  return (
    <main className="main">
      <Form
        onSubmit={handleSubmit}
        getFormApi={(api: BaseFormApi) => { formApi.current = api }}
        style={{ width: '100%' }}
      >
        <Form.Select 
          field='table' 
          label='Select Table' 
          placeholder="Please select a table"
          style={{ width: '100%' }}
          onChange={(value) => loadFieldList(value as string)}
          rules={[{ required: true, message: 'Please select a table' }]}
        >
          {tableMetaList.map(({ name, id }) => (
            <Form.Select.Option key={id} value={id}>
              {name}
            </Form.Select.Option>
          ))}
        </Form.Select>

        <Form.Select
          field='provider'
          label='AI Provider'
          placeholder='Select an AI provider'
          style={{ width: '100%' }}
          onChange={(value) => {
            const provider = value as string;
            setCurrentProvider(provider);
            localStorage.setItem('selected_provider', provider);
            
            // Load API key for the new provider
            const savedApiKey = localStorage.getItem(`${provider}_api_key`);
            if (savedApiKey) {
              formApi.current?.setValues({ apiKey: savedApiKey });
              if (provider === 'openrouter') {
                loadModels(savedApiKey);
              }
            } else {
              formApi.current?.setValues({ apiKey: '' });
              setModels([]);
            }
          }}
          rules={[{ required: true, message: 'Please select a provider' }]}
        >
          {PROVIDERS.map(({ value, label }) => (
            <Form.Select.Option key={value} value={value}>
              {label}
            </Form.Select.Option>
          ))}
        </Form.Select>

        <Form.Input
          field='apiKey'
          label='API Key'
          placeholder='Enter your API key'
          type={showApiKey ? 'text' : 'password'}
          style={{ width: '100%' }}
          suffix={
            <div 
              style={{ cursor: 'pointer', padding: '4px' }}
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <IconEyeClosed /> : <IconEyeOpened />}
            </div>
          }
          onChange={(value) => {
            const apiKey = value as string;
            // Save API key to localStorage with provider prefix
            if (apiKey && apiKey.length > 10) {
              localStorage.setItem(`${currentProvider}_api_key`, apiKey);
              if (currentProvider === 'openrouter') {
                loadModels(apiKey);
              }
            } else if (!apiKey) {
              // Remove API key if cleared
              localStorage.removeItem(`${currentProvider}_api_key`);
              setModels([]);
            }
          }}
          rules={[{ required: true, message: 'Please enter API key' }]}
        />

        <Form.TextArea
          field='systemPrompt'
          label='System Prompt'
          placeholder='Enter the system prompt for the AI model'
          style={{ width: '100%' }}
          autosize={{ minRows: 3, maxRows: 6 }}
          rules={[{ required: true, message: 'Please enter system prompt' }]}
        />

        <Form.Select
          field='model'
          label='AI Model'
          placeholder={loadingModels ? 'Loading models...' : 'Select an AI model'}
          style={{ width: '100%' }}
          loading={loadingModels}
          disabled={loadingModels || models.length === 0}
          filter
          rules={[{ required: true, message: 'Please select a model' }]}
        >
          {models.map((model) => (
            <Form.Select.Option 
              key={model.id} 
              value={model.id}
              label={`${model.name} ${model.id}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>{model.name}</span>
                {model.pricing && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                    ${model.pricing.prompt}/${model.pricing.completion}/M
                  </span>
                )}
              </div>
            </Form.Select.Option>
          ))}
        </Form.Select>

        <Form.Select
          field='userPromptFields'
          label='User Prompt Fields'
          placeholder='Select fields containing user prompts (will be combined)'
          multiple
          style={{ width: '100%' }}
          rules={[{ required: true, message: 'Please select at least one user prompt field' }]}
        >
          {fieldMetaList
            .filter(field => field.type === 1 || field.type === 2) // Text or Long Text
            .map(({ name, id }) => (
              <Form.Select.Option key={id} value={id}>
                {name}
              </Form.Select.Option>
            ))}
        </Form.Select>

        <Form.Select
          field='resultFields'
          label='Result Fields'
          placeholder='Select fields to store results (will only fill empty fields)'
          multiple
          style={{ width: '100%' }}
          rules={[{ required: true, message: 'Please select at least one result field' }]}
        >
          {fieldMetaList
            .filter(field => field.type === 1 || field.type === 2) // Text or Long Text
            .map(({ name, id }) => (
              <Form.Select.Option key={id} value={id}>
                {name}
              </Form.Select.Option>
            ))}
        </Form.Select>

        <Form.Slider
          field='temperature'
          label='Temperature (Creativity)'
          min={0}
          max={2}
          step={0.1}
          defaultValue={1}
          marks={{
            0: '0',
            0.5: '0.5',
            1: '1.0',
            1.5: '1.5',
            2: '2.0'
          }}
          style={{ width: '100%' }}
        />

        <Form.Slider
          field='topP'
          label='Top P (Diversity)'
          min={0}
          max={1}
          step={0.05}
          defaultValue={1}
          marks={{
            0: '0',
            0.25: '0.25',
            0.5: '0.5',
            0.75: '0.75',
            1: '1.0'
          }}
          style={{ width: '100%' }}
        />

        <div style={{ marginTop: 20 }}>
          <Button 
            theme='solid' 
            htmlType='submit' 
            loading={isProcessing}
            disabled={isProcessing}
            style={{ width: '100%' }}
          >
            {isProcessing ? 'Processing...' : 'Start Processing'}
          </Button>
        </div>

        {isProcessing && (
          <div style={{ marginTop: 20 }}>
            <Progress percent={progress} showInfo />
          </div>
        )}
      </Form>
    </main>
  );
}