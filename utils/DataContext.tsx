'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define types for our cached data
interface S3Bucket {
  Name: string;
  CreationDate?: Date;
  Status: "active" | "inactive";
}

interface QueueMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

interface Queue {
  url: string;
  name: string;
  messageCount: number;
  lastUpdated: Date;
}

interface ServiceHealth {
  name: string;
  status: string;
  latency: number | null;
  details: any;
}

interface HealthData {
  status: string;
  timestamp: string;
  services: ServiceHealth[];
  allAvailableServices: string[];
}

// Data context type definition
interface DataContextType {
  // S3 Buckets data
  buckets: S3Bucket[];
  loadingBuckets: boolean;
  bucketsError: string | null;
  fetchBuckets: () => Promise<void>;
  bucketLastUpdated: Date | null;
  bucketSearchQuery: string;
  setBucketSearchQuery: (query: string) => void;
  bucketSortField: string;
  setBucketSortField: (field: string) => void;
  bucketSortOrder: 'asc' | 'desc';
  setBucketSortOrder: (order: 'asc' | 'desc') => void;
  
  // SQS Queues data
  queues: Queue[];
  loadingQueues: boolean;
  queuesError: string | null;
  fetchQueues: () => Promise<void>;
  queueLastUpdated: Date | null;
  queueSearchQuery: string;
  setQueueSearchQuery: (query: string) => void;
  queueSortField: 'name' | 'messageCount';
  setQueueSortField: (field: 'name' | 'messageCount') => void;
  queueSortOrder: 'asc' | 'desc';
  setQueueSortOrder: (order: 'asc' | 'desc') => void;
  
  // Health data
  healthData: HealthData | null;
  loadingHealth: boolean;
  healthError: string | null;
  fetchHealthData: () => Promise<void>;
  healthLastUpdated: Date | null;
}

// Create the context with default values
const DataContext = createContext<DataContextType>({
  // S3 Buckets defaults
  buckets: [],
  loadingBuckets: false,
  bucketsError: null,
  fetchBuckets: async () => {},
  bucketLastUpdated: null,
  bucketSearchQuery: '',
  setBucketSearchQuery: () => {},
  bucketSortField: 'Name',
  setBucketSortField: () => {},
  bucketSortOrder: 'asc',
  setBucketSortOrder: () => {},
  
  // SQS Queues defaults
  queues: [],
  loadingQueues: false,
  queuesError: null,
  fetchQueues: async () => {},
  queueLastUpdated: null,
  queueSearchQuery: '',
  setQueueSearchQuery: () => {},
  queueSortField: 'name',
  setQueueSortField: () => {},
  queueSortOrder: 'asc',
  setQueueSortOrder: () => {},
  
  // Health data defaults
  healthData: null,
  loadingHealth: false,
  healthError: null,
  fetchHealthData: async () => {},
  healthLastUpdated: null,
});

// Provider component
export function DataProvider({ children }: { children: ReactNode }) {
  // S3 Buckets state
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState<boolean>(false);
  const [bucketsError, setBucketsError] = useState<string | null>(null);
  const [bucketLastUpdated, setBucketLastUpdated] = useState<Date | null>(null);
  
  // SQS Queues state
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loadingQueues, setLoadingQueues] = useState<boolean>(false);
  const [queuesError, setQueuesError] = useState<string | null>(null);
  const [queueLastUpdated, setQueueLastUpdated] = useState<Date | null>(null);
  const [queueSearchQuery, setQueueSearchQuery] = useState<string>('');
  const [queueSortField, setQueueSortField] = useState<'name' | 'messageCount'>('name');
  const [queueSortOrder, setQueueSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // S3 Buckets search and sort state
  const [bucketSearchQuery, setBucketSearchQuery] = useState<string>('');
  const [bucketSortField, setBucketSortField] = useState<string>('Name');
  const [bucketSortOrder, setBucketSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Health data state
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLastUpdated, setHealthLastUpdated] = useState<Date | null>(null);

  // Fetch S3 buckets
  const fetchBuckets = async () => {
    try {
      setLoadingBuckets(true);
      setBucketsError(null);
      
      const response = await fetch('/api/listBuckets');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setBuckets(data.buckets || []);
      setBucketLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching buckets:', err);
      setBucketsError(`Failed to load buckets: ${err.message}`);
    } finally {
      setLoadingBuckets(false);
    }
  };

  // Fetch SQS queues
  const fetchQueues = async () => {
    try {
      setLoadingQueues(true);
      setQueuesError(null);
      
      const response = await fetch('/api/listQueues');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        // Get the basic queue list first
        const queuesList = data.queues || [];
        
        // Fetch message counts for each queue
        const queuesWithAttributes = await Promise.all(queuesList.map(async (queue: Queue) => {
          try {
            const attrResponse = await fetch('/api/getQueueAttributes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ queueUrl: queue.url }),
            });
            
            if (attrResponse.ok) {
              const attrData = await attrResponse.json();
              if (attrData.success && attrData.attributes) {
                // Extract approximate number of messages
                const messageCount = parseInt(attrData.attributes.ApproximateNumberOfMessages) || 0;
                return {
                  ...queue,
                  messageCount,
                  lastUpdated: new Date()
                };
              }
            }
            // Return queue with default message count if there was an error
            return { ...queue, messageCount: 0, lastUpdated: new Date() };
          } catch (err) {
            console.error(`Error fetching attributes for queue ${queue.name}:`, err);
            // Return queue with default message count on error
            return { ...queue, messageCount: 0, lastUpdated: new Date() };
          }
        }));
        
        setQueues(queuesWithAttributes);
        setQueueLastUpdated(new Date());
      } else {
        throw new Error('Failed to fetch queues');
      }
    } catch (err: any) {
      console.error('Error fetching queues:', err);
      setQueuesError(`Failed to load queues: ${err.message}`);
    } finally {
      setLoadingQueues(false);
    }
  };

  // Fetch health data
  const fetchHealthData = async () => {
    try {
      setLoadingHealth(true);
      setHealthError(null);
      
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setHealthData(data);
      setHealthLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching health data:', err);
      setHealthError(`Failed to load health data: ${err.message}`);
    } finally {
      setLoadingHealth(false);
    }
  };

  return (
    <DataContext.Provider
      value={{
        buckets,
        loadingBuckets,
        bucketsError,
        fetchBuckets,
        bucketLastUpdated,
        bucketSearchQuery,
        setBucketSearchQuery,
        bucketSortField,
        setBucketSortField,
        bucketSortOrder,
        setBucketSortOrder,
        
        queues,
        loadingQueues,
        queuesError,
        fetchQueues,
        queueLastUpdated,
        queueSearchQuery,
        setQueueSearchQuery,
        queueSortField,
        setQueueSortField,
        queueSortOrder,
        setQueueSortOrder,
        
        healthData,
        loadingHealth,
        healthError,
        fetchHealthData,
        healthLastUpdated
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

// Custom hook to use the data context
export function useData() {
  return useContext(DataContext);
}
