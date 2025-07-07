import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { IconEyeClosed, IconEyeOpened } from '@douyinfe/semi-icons';
import { Button, Form, Progress, Toast } from '@douyinfe/semi-ui';
import { bitable, IFieldMeta, ITableMeta } from "@lark-base-open/js-sdk";
import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';

// Provider list
const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'doubao', label: 'Doubao' },
  { value: 'uniapi', label: 'UniAPI' },
];

interface FormValues {
  table: string;
  mode: 'separated' | 'messages'; // 'separated' for current mode, 'messages' for new mode
  systemPrompt: string;
  provider: string;
  model: string;
  apiKey: string;
  userPromptFields: string[];
  messagesField: string; // For messages mode
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
  const [currentMode, setCurrentMode] = useState<'separated' | 'messages'>('separated');
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
            mode: 'separated', // Default to separated mode
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
            loadModels(savedApiKey, savedProvider);
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

  // Load models based on provider
  const loadModels = useCallback(async (apiKey: string, provider: string) => {
    if (!apiKey) return;
    
    setLoadingModels(true);
    try {
      let modelList: Model[] = [];
      
      if (provider === 'openrouter') {
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
        modelList = data.data.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          pricing: model.pricing ? {
            prompt: (parseFloat(model.pricing.prompt) * 1000000).toFixed(2),
            completion: (parseFloat(model.pricing.completion) * 1000000).toFixed(2)
          } : undefined
        }));
      } else if (provider === 'doubao') {
        // Hardcoded Doubao model list
        modelList = [
          { id: 'doubao-seed-1-6-thinking-250615', name: 'Doubao-Seed-1.6-thinking (250615)', pricing: undefined },
          { id: 'doubao-seed-1-6-250615', name: 'Doubao-Seed-1.6 (250615)', pricing: undefined },
          { id: 'doubao-seed-1-6-flash-250615', name: 'Doubao-Seed-1.6-flash (250615)', pricing: undefined },
          { id: 'doubao-1-5-thinking-vision-pro-250428', name: 'Doubao-1.5-thinking-vision-pro (250428)', pricing: undefined },
          { id: 'doubao-seedream-3-0-t2i-250415', name: 'Doubao-Seedream-3.0-t2i (250415)', pricing: undefined },
          { id: 'doubao-seedance-1-0-lite-t2v-250428', name: 'Doubao-Seedance-1.0-lite-t2v (250428)', pricing: undefined },
          { id: 'doubao-seedance-1-0-lite-i2v-250428', name: 'Doubao-Seedance-1.0-lite-i2v (250428)', pricing: undefined },
          { id: 'doubao-1-5-ui-tars-250428', name: 'Doubao-1.5-UI-TARS (250428)', pricing: undefined },
          { id: 'doubao-1-5-thinking-pro-250415', name: 'Doubao-1.5-thinking-pro (250415)', pricing: undefined },
          { id: 'doubao-1-5-vision-pro-250328', name: 'Doubao-1.5-vision-pro (250328)', pricing: undefined },
          { id: 'doubao-1-5-vision-lite-250315', name: 'Doubao-1.5-vision-lite (250315)', pricing: undefined },
          { id: 'doubao-1-5-pro-256k-250115', name: 'Doubao-1.5-pro-256k (250115)', pricing: undefined },
          { id: 'doubao-1-5-vision-pro-32k-250115', name: 'Doubao-1.5-vision-pro-32k (250115)', pricing: undefined },
          { id: 'doubao-1-5-pro-32k-250115', name: 'Doubao-1.5-pro-32k (250115)', pricing: undefined },
          { id: 'doubao-1-5-lite-32k-250115', name: 'Doubao-1.5-lite-32k (250115)', pricing: undefined },
          { id: 'doubao-pro-256k-241115', name: 'Doubao-pro-256k (241115)', pricing: undefined },
          { id: 'doubao-pro-32k-241215', name: 'Doubao-pro-32k (241215)', pricing: undefined },
          { id: 'doubao-pro-128k-240628', name: 'Doubao-pro-128k (240628)', pricing: undefined },
          { id: 'doubao-pro-4k-240515', name: 'Doubao-pro-4k (240515)', pricing: undefined },
          { id: 'doubao-lite-32k-240828', name: 'Doubao-lite-32k (240828)', pricing: undefined },
          { id: 'doubao-lite-4k-character-240828', name: 'Doubao-lite-4k (character-240828)', pricing: undefined },
          { id: 'doubao-lite-128k-240828', name: 'Doubao-lite-128k (240828)', pricing: undefined },
        ];
      } else if (provider === 'uniapi') {
        // Fetch models from UniAPI
        const response = await fetch('https://api.uniapi.io/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }

        const data = await response.json();
        modelList = data.data.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          pricing: model.pricing ? {
            prompt: (parseFloat(model.pricing.prompt) * 1000000).toFixed(2),
            completion: (parseFloat(model.pricing.completion) * 1000000).toFixed(2)
          } : undefined
        }));
      }

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
    // Validate required fields based on mode
    if (!values.table || !values.apiKey || !values.mode) {
      Toast.error('Please fill in all required fields');
      return;
    }
    
    if (values.mode === 'separated' && (!values.userPromptFields?.length || !values.systemPrompt)) {
      Toast.error('Please fill in system prompt and user prompt fields for separated mode');
      return;
    }
    
    if (values.mode === 'messages' && !values.messagesField) {
      Toast.error('Please select a messages field for messages mode');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const table = await bitable.base.getTableById(values.table);
      const records = await table.getRecords({ pageSize: 5000 });
      
      let processedCount = 0;
      const totalCount = records.records.length;
      
      // Collect all records that need processing
      const recordsToProcess: Array<{
        record: any;
        messages: any[];
        fieldsToUpdate: string[];
      }> = [];

      for (const record of records.records) {
        let messages: any[] = [];
        
        if (values.mode === 'separated') {
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
          
          // Create messages array for separated mode
          messages = [
            { role: 'system', content: values.systemPrompt },
            { role: 'user', content: userPromptText }
          ];
        } else if (values.mode === 'messages') {
          // Extract messages from the messages field
          const fieldValue = record.fields[values.messagesField];
          if (!fieldValue) {
            processedCount++;
            setProgress(Math.round((processedCount / totalCount) * 100));
            continue;
          }
          
          try {
            // Parse messages from JSON string or extract from rich text
            let messagesData: any;
            
            if (typeof fieldValue === 'string') {
              // Try to parse as JSON
              try {
                messagesData = JSON.parse(fieldValue);
              } catch {
                // If not JSON, treat as plain text and assume it's a user message
                messages = [{ role: 'user', content: fieldValue }];
              }
            } else if (Array.isArray(fieldValue)) {
              // Handle rich text format
              const extractedText = fieldValue.map((item: any) => item.text || '').join('');
              try {
                messagesData = JSON.parse(extractedText);
              } catch {
                messages = [{ role: 'user', content: extractedText }];
              }
            } else {
              messagesData = fieldValue;
            }
            
            // If we have parsed data, use it as messages
            if (messagesData && Array.isArray(messagesData)) {
              messages = messagesData;
            } else if (messagesData && typeof messagesData === 'object') {
              // Single message object
              messages = [messagesData];
            }
            
            // Validate messages format
            if (!messages.every(msg => msg.role && msg.content)) {
              console.warn('Invalid messages format, skipping record');
              processedCount++;
              setProgress(Math.round((processedCount / totalCount) * 100));
              continue;
            }
          } catch (error) {
            console.error('Failed to parse messages field:', error);
            processedCount++;
            setProgress(Math.round((processedCount / totalCount) * 100));
            continue;
          }
        }

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

        // Add to processing queue
        recordsToProcess.push({
          record,
          messages,
          fieldsToUpdate
        });
      }

      // Process records in batches with concurrency control
      const BATCH_SIZE = 20; // Process 20 records concurrently
      
      for (let i = 0; i < recordsToProcess.length; i += BATCH_SIZE) {
        const batch = recordsToProcess.slice(i, i + BATCH_SIZE);
        
        // Process batch concurrently
        const batchPromises = batch.map(async ({ record, messages, fieldsToUpdate }) => {
          const updateFields: any = {};
          
          // Process all fields for this record concurrently
          const fieldPromises = fieldsToUpdate.map(async (fieldId) => {
            try {
              const result = await callAIAPIWithMessages(
                values.apiKey,
                values.provider,
                values.model,
                messages,
                values.temperature ?? 0,
                values.topP ?? 0
              );
              return { fieldId, result };
            } catch (error) {
              console.error(`Failed to process field ${fieldId}:`, error);
              return { fieldId, result: `Error: ${error}` };
            }
          });
          
          const fieldResults = await Promise.all(fieldPromises);
          
          // Collect results
          for (const { fieldId, result } of fieldResults) {
            updateFields[fieldId] = result;
          }
          
          // Update record if there are fields to update
          if (Object.keys(updateFields).length > 0) {
            await table.setRecord(record.recordId, { fields: updateFields });
          }
          
          processedCount++;
          setProgress(Math.round((processedCount / totalCount) * 100));
        });
        
        // Wait for current batch to complete before processing next batch
        await Promise.all(batchPromises);
      }
      
      // Update progress for skipped records
      setProgress(100);

      Toast.success('Processing completed successfully!');
    } catch (error) {
      console.error('Processing failed:', error);
      Toast.error(`Processing failed: ${error}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  // Call AI API with messages array
  const callAIAPIWithMessages = async (
    apiKey: string,
    provider: string,
    model: string,
    messages: any[],
    temperature?: number,
    topP?: number
  ): Promise<string> => {
    const requestBody: any = {
      model,
      messages
    };

    // Add optional parameters if provided
    if (temperature !== undefined) {
      requestBody.temperature = temperature;
    }
    if (topP !== undefined) {
      requestBody.top_p = topP;
    }

    let apiUrl: string;
    let headers: any = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      headers['HTTP-Referer'] = window.location.href;
      headers['X-Title'] = 'Lark Base Plugin';
    } else if (provider === 'doubao') {
      // Doubao uses a different endpoint format
      apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      // Doubao may require different headers
    } else if (provider === 'uniapi') {
      // UniAPI is OpenAI compatible
      apiUrl = 'https://api.uniapi.io/v1/chat/completions';
    } else {
      throw new Error('Unsupported provider');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
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
          field='mode'
          label='Data Mode'
          placeholder='Select data mode'
          style={{ width: '100%' }}
          onChange={(value) => {
            const mode = value as 'separated' | 'messages';
            setCurrentMode(mode);
          }}
          rules={[{ required: true, message: 'Please select data mode' }]}
        >
          <Form.Select.Option value='separated'>
            Separated (System Prompt + User Prompt Fields)
          </Form.Select.Option>
          <Form.Select.Option value='messages'>
            Messages (Single Messages Field)
          </Form.Select.Option>
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
            
            // Always clear the model when switching provider
            formApi.current?.setValue('model', '');
            
            if (savedApiKey) {
              // Update API key and load models
              formApi.current?.setValue('apiKey', savedApiKey);
              loadModels(savedApiKey, provider);
            } else {
              // Clear API key and models when no saved key exists
              formApi.current?.setValue('apiKey', '');
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
              loadModels(apiKey, currentProvider);
            } else if (!apiKey) {
              // Remove API key if cleared
              localStorage.removeItem(`${currentProvider}_api_key`);
              setModels([]);
            }
          }}
          rules={[{ required: true, message: 'Please enter API key' }]}
        />

        {currentMode === 'separated' && (
          <Form.TextArea
            field='systemPrompt'
            label='System Prompt'
            placeholder='Enter the system prompt for the AI model'
            style={{ width: '100%' }}
            autosize={{ minRows: 3, maxRows: 6 }}
            rules={[{ required: true, message: 'Please enter system prompt' }]}
          />
        )}

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
              label={model.name}
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

        {currentMode === 'separated' && (
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
        )}

        {currentMode === 'messages' && (
          <Form.Select
            field='messagesField'
            label='Messages Field'
            placeholder='Select field containing messages array'
            style={{ width: '100%' }}
            rules={[{ required: true, message: 'Please select a messages field' }]}
          >
            {fieldMetaList
              .filter(field => field.type === 1 || field.type === 2) // Text or Long Text
              .map(({ name, id }) => (
                <Form.Select.Option key={id} value={id}>
                  {name}
                </Form.Select.Option>
              ))}
          </Form.Select>
        )}

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
          defaultValue={0}
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
          defaultValue={0}
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