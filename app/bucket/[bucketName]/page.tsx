"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FaSearch, FaArrowLeft, FaExclamationTriangle, FaSpinner, FaDownload } from 'react-icons/fa';
import styles from './bucket.module.css';

// Define interface for S3 objects
interface S3Object {
  Key?: string;
  Size?: number;
  LastModified?: Date;
  ETag?: string;
}

export default function BucketPage() {
  const params = useParams();
  const bucketName = params.bucketName as string;
  
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const fetchObjects = async () => {
      if (!bucketName) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/listObjects?bucket=${encodeURIComponent(bucketName)}`);
        
        // Log response details to help debug
        console.log('API Response Status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setObjects(data.objects || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching bucket objects:', err);
        setError(`Failed to load bucket contents: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchObjects();
  }, [bucketName]);

  // Download file function
  const downloadFile = async (key: string) => {
    if (!key || !bucketName) return;
    
    try {
      setDownloading(key);
      
      // Create a presigned URL for downloading the file
      const response = await fetch(`/api/getPresignedUrl?bucket=${encodeURIComponent(bucketName)}&key=${encodeURIComponent(key)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to generate download link: ${response.statusText}`);
      }
      
      const { url } = await response.json();
      
      // Create an anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', key.split('/').pop() || key);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err: any) {
      console.error('Error downloading file:', err);
      alert(`Failed to download file: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  // Helper function to format file size
  const formatFileSize = (sizeInBytes?: number): string => {
    if (!sizeInBytes) return 'Unknown size';
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    else if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(2)} KB`;
    else if (sizeInBytes < 1024 * 1024 * 1024) return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
    else return `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Helper function to get file extension
  const getFileExtension = (filename?: string): string => {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  };

  // Filter objects by search query
  const filteredObjects = objects.filter(object => 
    object.Key?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date in a more readable way
  const formatDate = (date?: Date): string => {
    if (!date) return 'Unknown date';
    const d = new Date(date);
    
    // If it's today, show time only
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return `Today at ${d.toLocaleTimeString()}`;
    }

    // If it's within the last 7 days, show day name
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    if (d > lastWeek) {
      return `${d.toLocaleDateString(undefined, { weekday: 'long' })} at ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Otherwise show the full date
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <Link href="/dashboard" className={styles.backLink}>
          <FaArrowLeft style={{ marginRight: '8px' }} /> Back to Buckets
        </Link>
        <h1 className="text-2xl font-bold mt-2">Files in Bucket: {bucketName}</h1>
      </div>
      
      {error && (
        <div className={styles.error}>
          <FaExclamationTriangle style={{ marginRight: '10px', fontSize: '1.2rem' }} />
          {error}
        </div>
      )}
      
      {!error && (
        <>
          <div className={styles.headerActions}>
            <h2 className="text-xl font-semibold">Files ({objects.length})</h2>
          </div>
          
          <div className={styles.searchContainer}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search files by name..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {isLoading ? (
            <div className={styles.statusWrapper}>
              <div className={styles.loadingIndicator}>
                <FaSpinner className="animate-spin" />
                <span>Loading bucket contents...</span>
              </div>
            </div>
          ) : filteredObjects.length === 0 ? (
            <div className={styles.emptyState}>
              <Image
                src="/file.svg"
                alt="No files"
                width={64}
                height={64}
                style={{ margin: '0 auto 20px', opacity: 0.5 }}
              />
              <p className="text-gray-500">
                {searchQuery 
                  ? `No files found matching "${searchQuery}"` 
                  : 'No files found in this bucket.'}
              </p>
            </div>
          ) : (
            <div className={styles.fileList}>
              <table className={styles.fileTable}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Size</th>
                    <th>Last Modified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredObjects.map((object, index) => (
                    <tr key={object.Key || index}>
                      <td className={styles.fileName}>
                        <Image 
                          src="/file.svg" 
                          alt="File" 
                          width={20} 
                          height={20} 
                          className={styles.fileIcon}
                        />
                        {object.Key}
                      </td>
                      <td className={styles.fileSize}>{formatFileSize(object.Size)}</td>
                      <td className={styles.fileDate}>
                        {formatDate(object.LastModified)}
                      </td>
                      <td className={styles.actionCell}>
                        <button 
                          className={styles.downloadButton}
                          onClick={() => object.Key && downloadFile(object.Key)}
                          disabled={downloading === object.Key}
                        >
                          {downloading === object.Key ? (
                            <FaSpinner className="animate-spin mr-1" />
                          ) : (
                            <FaDownload />
                          )}
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}