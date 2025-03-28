'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiRefreshCw, FiArrowLeft, FiCheck, FiAlertTriangle, FiX, FiClock, FiSlash, FiSettings, FiPlus } from 'react-icons/fi';
import styles from './health.module.css';
import TabNavigation from '../components/TabNavigation';

interface ServiceHealth {
  name: string;
  status: string;
  latency: number | null;
  details: any;
}

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  services: ServiceHealth[];
  allAvailableServices: string[];
}

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingServices, setRefreshingServices] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [monitoredServices, setMonitoredServices] = useState<string[]>([]);
  const [allAvailableServices, setAllAvailableServices] = useState<string[]>([]);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);

  // Fetch health data from the API
  const fetchHealthData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthData(data);
      
      // Update our list of all available services
      if (data.allAvailableServices) {
        setAllAvailableServices(data.allAvailableServices);
      }
    } catch (err: any) {
      setError('Failed to fetch health data: ' + (err.message || 'Unknown error'));
      console.error('Health fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh an individual service
  const refreshService = async (serviceName: string) => {
    setRefreshingServices(prev => ({ ...prev, [serviceName]: true }));
    
    try {
      const response = await fetch(`/api/health?service=${serviceName}`);
      const data = await response.json();
      
      // Update the specific service from the response
      const updatedService = data.services.find((s: ServiceHealth) => s.name === serviceName);
      
      if (updatedService && healthData) {
        setHealthData({
          ...healthData,
          status: data.status,
          timestamp: data.timestamp,
          services: healthData.services.map(s => 
            s.name === serviceName ? updatedService : s
          )
        });
      }
    } catch (err: any) {
      console.error(`Failed to refresh service ${serviceName}:`, err);
    } finally {
      setRefreshingServices(prev => ({ ...prev, [serviceName]: false }));
    }
  };
  
  // Add a service to be monitored
  const addServiceToMonitor = async (serviceName: string) => {
    if (!monitoredServices.includes(serviceName)) {
      const updatedServices = [...monitoredServices, serviceName];
      await updateMonitoringPreferences(updatedServices);
    }
  };
  
  // Remove a service from monitoring
  const removeServiceFromMonitor = async (serviceName: string) => {
    if (monitoredServices.includes(serviceName)) {
      const updatedServices = monitoredServices.filter(name => name !== serviceName);
      await updateMonitoringPreferences(updatedServices);
    }
  };
  
  // Update service monitoring preferences
  const updateMonitoringPreferences = async (services: string[]) => {
    setSettingsLoading(true);
    try {
      const response = await fetch('/api/updateMonitoringPreferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ services })
      });
      
      const data = await response.json();
      if (data.success) {
        setMonitoredServices(data.monitoredServices);
        // Refresh health data to reflect new monitoring preferences
        await fetchHealthData();
      }
    } catch (err: any) {
      console.error('Failed to update monitoring preferences:', err);
      setError('Failed to update monitoring preferences: ' + (err.message || 'Unknown error'));
    } finally {
      setSettingsLoading(false);
    }
  };
  
  // Reset monitoring preferences to default
  const resetMonitoringPreferences = async () => {
    setSettingsLoading(true);
    try {
      const response = await fetch('/api/updateMonitoringPreferences', {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        setMonitoredServices(data.monitoredServices);
        // Refresh health data to reflect default monitoring preferences
        await fetchHealthData();
      }
    } catch (err: any) {
      console.error('Failed to reset monitoring preferences:', err);
      setError('Failed to reset monitoring preferences: ' + (err.message || 'Unknown error'));
    } finally {
      setSettingsLoading(false);
    }
  };

  // Fetch monitoring preferences
  const fetchMonitoringPreferences = async () => {
    try {
      const response = await fetch('/api/updateMonitoringPreferences');
      const data = await response.json();
      if (data.success) {
        setMonitoredServices(data.monitoredServices);
        setAllAvailableServices(data.allAvailableServices);
      }
    } catch (err) {
      console.error('Failed to fetch monitoring preferences:', err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    // First fetch monitoring preferences
    fetchMonitoringPreferences();
    // Then fetch health data
    fetchHealthData();
  }, []);

  // Format timestamp to a readable format
  const formatTimestamp = (timestamp: string): string => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (err) {
      return 'Invalid timestamp';
    }
  };

  // Determine the appropriate class for latency values
  const getLatencyClass = (latency: number | null): string => {
    if (latency === null) return '';
    if (latency < 200) return styles.goodLatency;
    if (latency < 500) return styles.mediumLatency;
    return styles.badLatency;
  };

  // Get the appropriate service status class
  const getServiceStatusClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'healthy':
        return styles.serviceStatusHealthy;
      case 'degraded':
        return styles.serviceStatusDegraded;
      case 'error':
        return styles.serviceStatusError;
      default:
        return '';
    }
  };

  // Sort services with healthy ones at the top
  const sortedServices = healthData?.services
    ? [...healthData.services].sort((a, b) => {
        // First sort by status (healthy first, then others)
        if (a.status === 'healthy' && b.status !== 'healthy') return -1;
        if (a.status !== 'healthy' && b.status === 'healthy') return 1;
        
        // If status is the same, sort by name
        return a.name.localeCompare(b.name);
      })
    : [];

  // Get list of unmonitored services (services available but not in the monitoring list)
  const unmonitoredServices = allAvailableServices.filter(
    service => !monitoredServices.includes(service)
  );

  return (
    <main className={styles.main}>
      <div className={styles.pageContainer}>
        <div className={styles.tabContainer}>
          <TabNavigation />
        </div>
        
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>LocalStack Health Monitor</h1>
            <p className={styles.subtitle}>
              Monitor the health and status of your LocalStack services
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.button} ${styles.settingsButton}`}
              onClick={() => setShowSettings(!showSettings)}
              title="Configure monitored services"
            >
              <FiSettings size={16} />
              Settings
            </button>
            <button
              className={`${styles.button} ${styles.refreshButton}`}
              onClick={fetchHealthData}
              disabled={loading}
            >
              <FiRefreshCw size={16} />
              {loading ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingsPanelHeader}>
              <h2 className={styles.settingsPanelTitle}>Monitoring Settings</h2>
              <p className={styles.settingsPanelDescription}>
                Select which services to monitor. Changes will take effect immediately.
              </p>
            </div>
            
            <div className={styles.servicesList}>
              <h3 className={styles.serviceListTitle}>Currently Monitored Services</h3>
              <div className={styles.serviceCheckboxes}>
                {monitoredServices.map(service => (
                  <label key={service} className={styles.serviceCheckbox}>
                    <input 
                      type="checkbox" 
                      checked={true}
                      onChange={() => removeServiceFromMonitor(service)}
                      disabled={settingsLoading}
                    />
                    {service}
                  </label>
                ))}
              </div>
              
              {unmonitoredServices.length > 0 && (
                <>
                  <h3 className={styles.serviceListTitle}>Available Services</h3>
                  <div className={styles.serviceCheckboxes}>
                    {unmonitoredServices.map(service => (
                      <button 
                        key={service}
                        onClick={() => addServiceToMonitor(service)}
                        disabled={settingsLoading}
                        className={styles.addServiceButton}
                      >
                        <FiPlus size={14} />
                        {service}
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              <div className={styles.settingsActions}>
                <button
                  onClick={resetMonitoringPreferences}
                  disabled={settingsLoading}
                  className={styles.resetButton}
                >
                  Reset to Defaults
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className={styles.closeSettingsButton}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && !healthData ? (
          <div className={styles.loadingIndicator}>
            <FiRefreshCw className={styles.spinIcon} />
            <span>Loading health data...</span>
          </div>
        ) : error ? (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        ) : healthData ? (
          <>
            {/* Overall Status Panel */}
            <div className={styles.statusPanel}>
              <div className={styles.statusHeader}>
                <h2 className={styles.statusTitle}>Overall Status</h2>
                <div className={styles.statusTime}>Last checked: {formatTimestamp(healthData.timestamp)}</div>
              </div>
              
              <div className={`${styles.healthStatus} ${styles[healthData.status]}`}>
                <div className={styles.healthStatusInner}>
                  <div className={styles.healthStatusText}>
                    {healthData.status === 'healthy' && <FiCheck size={20} />}
                    {healthData.status === 'degraded' && <FiAlertTriangle size={20} />}
                    {healthData.status === 'error' && <FiX size={20} />}
                    {' '}{healthData.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Health Summary */}
            <div className={styles.healthSummary}>
              <p className={styles.summaryText}>
                <span className={styles.healthyCount}>
                  {healthData.services.filter(s => s.status === 'healthy').length} healthy
                </span>
                {' | '}
                <span className={styles.errorCount}>
                  {healthData.services.filter(s => s.status === 'error').length} error
                </span>
                {' | '}
                <span className={styles.unavailableCount}>
                  {unmonitoredServices.length} unmonitored
                </span>
                {' | '}
                <span className={styles.totalCount}>
                  {allAvailableServices.length} total services
                </span>
              </p>
            </div>

            {/* Services Grid */}
            <div className={styles.servicesGrid}>
              {sortedServices.map((service) => (
                <div key={service.name} className={styles.serviceCard}>
                  <div className={styles.serviceHeader}>
                    <h3 className={styles.serviceName}>{service.name}</h3>
                    <div className={styles.serviceActions}>
                      <button 
                        className={styles.serviceRefreshButton}
                        onClick={() => refreshService(service.name)}
                        disabled={refreshingServices[service.name]}
                        title={`Refresh ${service.name} status`}
                      >
                        <FiRefreshCw 
                          className={refreshingServices[service.name] ? styles.spinIcon : ''} 
                          size={16} 
                        />
                      </button>
                      <button
                        className={styles.serviceMonitorToggle}
                        onClick={() => removeServiceFromMonitor(service.name)}
                        title={`Stop monitoring ${service.name}`}
                      >
                        <FiX size={14} />
                      </button>
                      <div className={`${styles.serviceStatus} ${getServiceStatusClass(service.status)}`}>
                        {service.status}
                      </div>
                    </div>
                  </div>
                  <div className={styles.serviceContent}>
                    {service.latency !== null && (
                      <div className={styles.serviceDetail}>
                        <span className={styles.serviceDetailLabel}>Response Time</span>
                        <div className={styles.serviceLatency}>
                          <FiClock size={14} />
                          <span className={`${styles.latencyBadge} ${getLatencyClass(service.latency)}`}>
                            {service.latency} ms
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {service.details && service.status === 'healthy' && (
                      <>
                        {service.name === 'SQS' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>Queue Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.queueCount}
                            </div>
                          </div>
                        )}
                        
                        {service.name === 'S3' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>Bucket Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.bucketCount}
                            </div>
                          </div>
                        )}
                        
                        {service.name === 'DynamoDB' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>Table Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.tableCount}
                            </div>
                          </div>
                        )}
                        
                        {service.name === 'Lambda' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>Function Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.functionCount}
                            </div>
                          </div>
                        )}
                        
                        {service.name === 'SNS' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>Topic Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.topicCount}
                            </div>
                          </div>
                        )}
                        
                        {service.name === 'CloudWatch' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>Log Group Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.logGroupCount}
                            </div>
                          </div>
                        )}
                        
                        {service.name === 'API Gateway' && (
                          <div className={styles.serviceDetail}>
                            <span className={styles.serviceDetailLabel}>API Count</span>
                            <div className={styles.serviceDetailValue}>
                              {service.details.apiCount}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {service.details && service.status === 'error' && (
                      <div className={styles.errorMessage}>
                        {service.details.message || 'Error connecting to service'}
                        {service.details.code && <div>Code: {service.details.code}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Unmonitored Services Section */}
              {unmonitoredServices.length > 0 && (
                <>
                  <div className={styles.sectionDivider}>
                    <h3 className={styles.sectionTitle}>Unmonitored Services</h3>
                    <p className={styles.sectionSubtitle}>These services are available in LocalStack but not currently monitored</p>
                  </div>
                  
                  {unmonitoredServices.map((serviceName) => (
                    <div key={serviceName} className={`${styles.serviceCard} ${styles.unmonitoredCard}`}>
                      <div className={styles.serviceHeader}>
                        <h3 className={styles.serviceName}>{serviceName}</h3>
                        <div className={styles.serviceActions}>
                          <button
                            className={styles.addMonitorButton}
                            onClick={() => addServiceToMonitor(serviceName)}
                            title={`Start monitoring ${serviceName}`}
                            disabled={settingsLoading}
                          >
                            <FiPlus size={14} />
                            Monitor
                          </button>
                          <div className={`${styles.serviceStatus} ${styles.serviceStatusUnmonitored}`}>
                            Not Monitored
                          </div>
                        </div>
                      </div>
                      <div className={styles.serviceContent}>
                        <div className={styles.unmonitoredServiceContent}>
                          <FiSlash size={24} className={styles.unmonitoredIcon} />
                          <p className={styles.unmonitoredText}>
                            Click "Monitor" to add this service to your health dashboard
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <div className={styles.errorMessage}>No health data available</div>
        )}
      </div>
    </main>
  );
}