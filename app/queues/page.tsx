'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiRefreshCw, FiSend, FiMessageSquare, FiSearch, FiArrowLeft, FiClock } from 'react-icons/fi';
import styles from './queues.module.css';
import TabNavigation from "../components/TabNavigation";
import { useData } from "../../utils/DataContext";

interface Queue {
  url: string;
  name: string;
  messageCount: number;
  lastUpdated: Date; // Add timestamp for queue
}

interface QueueMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

export default function QueuesPage() {
  // Use the data context for caching between tabs
  const { 
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
    setQueueSortOrder
  } = useData();
  
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [messages, setMessages] = useState<QueueMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  
  // Use search query from context (for persistence across tab changes)
  const searchQuery = queueSearchQuery;
  const setSearchQuery = setQueueSearchQuery;
  
  // Use sort settings from context (for persistence across tab changes)
  const sortField = queueSortField;
  const setSortField = setQueueSortField;
  const sortOrder = queueSortOrder;
  const setSortOrder = setQueueSortOrder;
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [queuesPerPage] = useState(10); // 10 queues per page
  
  // Auto-refresh settings
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [refreshTimerId, setRefreshTimerId] = useState<NodeJS.Timeout | null>(null);

  // Format timestamp to a readable format
  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  // Add an error state for message operations
  const [error, setError] = useState<string | null>(null);

  // Format visibility timeout in a human-readable way
  const formatVisibilityTimeout = (seconds: string | undefined): string => {
    if (!seconds) return 'Not available';
    
    const secs = parseInt(seconds);
    if (isNaN(secs)) return 'Invalid';
    
    if (secs < 60) {
      return `${secs} second${secs !== 1 ? 's' : ''}`;
    } else if (secs < 3600) {
      const mins = Math.floor(secs / 60);
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(secs / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
  };

  // Load queues data when component mounts if not already cached
  useEffect(() => {
    if (queues.length === 0 && !loadingQueues) {
      fetchQueues();
    }
  }, [queues.length, loadingQueues, fetchQueues]);

  // Clear selected queue when queues change
  useEffect(() => {
    if (selectedQueue && !queues.some(q => q.url === selectedQueue)) {
      setSelectedQueue(null);
      setMessages([]);
    }
  }, [queues, selectedQueue]);

  // Fetch messages is still needed for individual queue messages

  // Fetch messages from selected queue
  const fetchMessages = async () => {
    if (!selectedQueue) return;

    setMessagesLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/receiveMessages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queueUrl: selectedQueue,
          maxMessages: 10,
          waitTimeSeconds: 1,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('Received messages:', data.messages);
        setMessages(data.messages || []);
        
        // Queue timestamp is managed by the DataContext
        // We don't need to update queues locally anymore
      } else {
        setError(data.error || 'Failed to fetch messages');
      }
    } catch (err) {
      setError('Error fetching messages from queue');
      console.error('Error fetching messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Delete a message from the queue
  const deleteMessage = async (receiptHandle: string) => {
    if (!selectedQueue || !receiptHandle) return;

    setDeleteLoading(receiptHandle);
    setError(null);
    try {
      const response = await fetch('/api/deleteMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queueUrl: selectedQueue,
          receiptHandle: receiptHandle,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages(messages.filter(msg => msg.ReceiptHandle !== receiptHandle));
      } else {
        setError(data.error || 'Failed to delete message');
      }
    } catch (err) {
      setError('Error deleting message from queue');
      console.error('Error deleting message:', err);
    } finally {
      setDeleteLoading(null);
    }
  };

  // Get queue name from URL for display purposes
  const getQueueName = (queueUrl: string) => {
    const queue = queues.find((q) => q.url === queueUrl);
    return queue ? queue.name : 'Unknown Queue';
  };

  // Send a new message to the selected queue
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedQueue || !messageBody.trim()) return;

    setSendingMessage(true);
    setError(null);
    try {
      const response = await fetch('/api/sendMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queueUrl: selectedQueue,
          messageBody: messageBody.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessageBody('');
        fetchMessages();
        
        // Queue timestamp is managed by the DataContext
        // We don't need to update queues locally anymore
        // This will be refreshed when fetching queues
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Error sending message to queue');
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // Filter queues based on search query
  const filteredQueues = searchQuery.trim() === '' 
    ? queues 
    : queues.filter(queue => 
        queue.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  // Sort queues by selected field and order
  const sortedQueues = [...filteredQueues].sort((a, b) => {
    if (sortField === 'name') {
      return sortOrder === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortField === 'messageCount') {
      return sortOrder === 'asc' 
        ? a.messageCount - b.messageCount 
        : b.messageCount - a.messageCount;
    }
    return 0;
  });

  // Get current page queues
  const indexOfLastQueue = currentPage * queuesPerPage;
  const indexOfFirstQueue = indexOfLastQueue - queuesPerPage;
  const currentQueues = sortedQueues.slice(indexOfFirstQueue, indexOfLastQueue);
  
  // Calculate total pages
  const totalPages = Math.ceil(sortedQueues.length / queuesPerPage);
  
  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  // Handle sorting when a column header is clicked
  const handleSort = (field: 'name' | 'messageCount') => {
    if (sortField === field) {
      // If clicking the same field, toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a different field, set as the new sort field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Initial load of queues is handled by the useEffect above
  // which checks if queues.length === 0

  // When a queue is selected, fetch its messages
  useEffect(() => {
    if (selectedQueue) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedQueue]);

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);
  
  // Handle auto-refresh setup
  useEffect(() => {
    // Clear existing timer when interval changes
    if (refreshTimerId) {
      clearInterval(refreshTimerId);
      setRefreshTimerId(null);
    }
    
    // If an interval is set, start a new timer
    if (refreshInterval) {
      // Convert seconds to milliseconds
      const intervalMs = refreshInterval * 1000;
      
      const timerId = setInterval(() => {
        // This will preserve the current sort settings because they're in state
        fetchQueues();
      }, intervalMs);
      
      setRefreshTimerId(timerId);
    }
    
    // Clean up function to clear interval on unmount or interval change
    return () => {
      if (refreshTimerId) {
        clearInterval(refreshTimerId);
      }
    };
  }, [refreshInterval, fetchQueues]);

  return (
    <main className={styles.main}>
      <div className={styles.pageContainer}>
        <div className={styles.tabContainer}>
          <TabNavigation />
        </div>
        
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>LocalStack SQS Monitor</h1>
            <p className={styles.subtitle}>
              View and manage SQS queues in your local development environment
            </p>
            {queueLastUpdated && (
              <p className={styles.lastUpdated}>
                Last updated: {queueLastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className={styles.headerActions}>
            {/* Refresh button removed - using only one refresh button in the list header */}
          </div>
        </div>
        
        {/* Queue List Header with Search and Refresh */}
        <div className={styles.queueListHeader}>
          <div className={styles.searchContainer}>
            <FiSearch size={16} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search queues..." 
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.refreshControls}>
            <div className={styles.autoRefreshSelector}>
              <label htmlFor="refresh-interval">Auto-refresh:</label>
              <select
                id="refresh-interval"
                value={refreshInterval || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setRefreshInterval(value ? parseInt(value) : null);
                }}
                className={styles.refreshSelect}
              >
                <option value="">Off</option>
                <option value="5">5s</option>
                <option value="10">10s</option>
                <option value="20">20s</option>
                <option value="30">30s</option>
              </select>
            </div>
            <button
              className={`${styles.button} ${styles.refreshButton}`}
              onClick={fetchQueues}
              disabled={loadingQueues}
            >
              <FiRefreshCw size={16} />
              {loadingQueues ? 'Refreshing...' : 'Refresh Queues'}
            </button>
          </div>
        </div>
        
        {/* Queue List */}
        <div className={styles.queueList}>
          {loadingQueues ? (
            <div className={styles.loadingIndicator}>
              <FiRefreshCw className={styles.spinIcon} />
              <span>Loading queues...</span>
            </div>
          ) : currentQueues.length === 0 ? (
            <div className={styles.emptyState}>
              {searchQuery.trim() !== '' ? (
                <p>No queues found matching "{searchQuery}"</p>
              ) : (
                <>
                  <p>No SQS queues found in LocalStack.</p>
                  <p>Make sure LocalStack is running and has SQS queues created.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <table className={styles.queueTable}>
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('name')} 
                      className={styles.sortableHeader}
                    >
                      Queue Name 
                      {sortField === 'name' && (
                        <span className={styles.sortIcon}>
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th 
                      onClick={() => handleSort('messageCount')} 
                      className={styles.sortableHeader}
                    >
                      Message Count
                      {sortField === 'messageCount' && (
                        <span className={styles.sortIcon}>
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                    <th>Last Updated</th>
                    <th className={styles.actionCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentQueues.map((queue) => (
                    <tr
                      key={queue.url}
                      className={selectedQueue === queue.url ? styles.selectedRow : ''}
                    >
                      <td className={styles.queueName}>{queue.name}</td>
                      <td className={styles.queueMessageCount}>{queue.messageCount}</td>
                      <td className={styles.queueTimestamp}>
                        <FiClock size={14} className={styles.timestampIcon} />
                        {formatTimestamp(queue.lastUpdated)}
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          className={styles.button}
                          onClick={() => setSelectedQueue(queue.url)}
                        >
                          <FiMessageSquare size={16} />
                          View Messages
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.pagination}>
                {Array.from({ length: totalPages }, (_, index) => (
                  <button
                    key={index + 1}
                    className={`${styles.button} ${currentPage === index + 1 ? styles.activePage : ''}`}
                    onClick={() => paginate(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        
        {/* Selected Queue Details & Messages */}
        {selectedQueue && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <h2 className={styles.queueDetailTitle}>
                {getQueueName(selectedQueue)}
                <span className={styles.queueDetailTimestamp}>
                  <FiClock size={14} />
                  Last updated: {formatTimestamp(queues.find(q => q.url === selectedQueue)?.lastUpdated || new Date())}
                </span>
              </h2>
              <div className={styles.queueDetailActions}>
                <button
                  className={`${styles.button} ${styles.refreshButton}`}
                  onClick={fetchMessages}
                  disabled={messagesLoading}
                >
                  <FiRefreshCw size={16} />
                  {messagesLoading ? 'Refreshing...' : 'Refresh Messages'}
                </button>
              </div>
            </div>

            {/* Send Message Form */}
            <div className={styles.sendMessageForm}>
              <h3 className={styles.formTitle}>Send Message to Queue</h3>
              <form onSubmit={sendMessage}>
                <div className={styles.formGroup}>
                  <label htmlFor="messageBody" className={styles.formLabel}>
                    Message Body
                  </label>
                  <textarea
                    id="messageBody"
                    className={styles.formTextarea}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Enter message body (JSON or plain text)"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.sendButton}`}
                  disabled={sendingMessage || !messageBody.trim()}
                >
                  <FiSend size={16} />
                  {sendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
            
            {/* Messages Section */}
            <div className={styles.messagesSection}>
              <h3 className={styles.sectionTitle}>Messages in Queue</h3>
              
              {messagesLoading ? (
                <div className={styles.loadingIndicator}>
                  <FiRefreshCw className={styles.spinIcon} />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No messages available in this queue.</p>
                  <p className={styles.infoText}>
                    Note: SQS messages may be temporarily invisible after being received.
                    Try again in a few seconds or send a new message.
                  </p>
                </div>
              ) : (
                <div className={styles.messagesTable}>
                  <table className={styles.queueTable}>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Message ID</th>
                        <th>Body</th>
                        <th>Visibility Timeout</th>
                        <th>Attributes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((message, index) => (
                        <tr key={message.MessageId} className={styles.messageRow}>
                          <td className={styles.messageNumber}>#{index + 1}</td>
                          <td className={styles.messageIdCell}>{message.MessageId}</td>
                          <td className={styles.messageBodyCell}>
                            <div className={styles.messageBodyContent}>{message.Body}</div>
                          </td>
                          <td className={styles.messageVisibilityCell}>
                            {formatVisibilityTimeout(message.Attributes?.VisibilityTimeout)}
                          </td>
                          <td className={styles.messageAttributesCell}>
                            {message.Attributes && Object.keys(message.Attributes).length > 0 && (
                              <div className={styles.messageAttributes}>
                                {Object.entries(message.Attributes)
                                  .filter(([key]) => key !== 'VisibilityTimeout') // Don't show VisibilityTimeout here since it has its own column
                                  .map(([key, value]) => (
                                  <div key={key} className={styles.attributeItem}>
                                    <span className={styles.attributeName}>{key}:</span>{' '}
                                    <span className={styles.attributeValue}>{value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className={styles.actionCell}>
                            <button
                              className={`${styles.button} ${styles.deleteButton}`}
                              onClick={() => deleteMessage(message.ReceiptHandle)}
                              disabled={deleteLoading === message.ReceiptHandle}
                            >
                              {deleteLoading === message.ReceiptHandle ? 'Deleting...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}