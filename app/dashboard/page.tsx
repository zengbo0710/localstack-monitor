"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { FaSearch, FaPlus, FaBox, FaExclamationTriangle, FaChevronRight, FaSpinner } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import styles from "./dashboard.module.css";
import TabNavigation from "../components/TabNavigation";
import { useData } from "../../utils/DataContext";

interface S3Bucket {
  Name: string;
  CreationDate?: Date;
  Status: "active" | "inactive";
}

export default function Dashboard() {
  // Use the data context for caching between tabs
  const { 
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
    setBucketSortOrder
  } = useData();
  
  // Use search query from context (for persistence across tab changes)
  const searchQuery = bucketSearchQuery;
  const setSearchQuery = setBucketSearchQuery;
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newBucketName, setNewBucketName] = useState<string>("");

  useEffect(() => {
    // Fetch buckets when component mounts if not already cached
    if (buckets.length === 0 && !loadingBuckets) {
      fetchBuckets();
    }
  }, [buckets.length, loadingBuckets, fetchBuckets]);

  const filteredBuckets = buckets.filter(bucket =>
    bucket.Name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Format date in a more readable way
  const formatDate = (date?: Date): string => {
    if (!date) return 'Unknown date';
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <main className={styles.main}>
      <div className={styles.pageContainer}>
        <div className={styles.tabContainer}>
          <TabNavigation />
        </div>
        
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>S3 Buckets</h1>
            <p className={styles.subtitle}>Manage and access your cloud storage buckets</p>
            {bucketLastUpdated && (
              <p className={styles.lastUpdated}>
                Last updated: {bucketLastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              className={`${styles.button} ${styles.refreshButton}`}
              onClick={fetchBuckets}
              disabled={loadingBuckets}
            >
              <FiRefreshCw size={16} />
              {loadingBuckets ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              className={styles.createButton}
              onClick={() => setShowCreateModal(true)}
            >
              <FaPlus className={styles.createButtonIcon} /> Create Bucket
            </button>
          </div>
        </div>
        
        <div className={styles.searchContainer}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search buckets by name..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loadingBuckets}
          />
        </div>
        
        {loadingBuckets ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}>
              <FaSpinner className="animate-spin text-xl" />
              <span>Loading buckets...</span>
            </div>
          </div>
        ) : bucketsError ? (
          <div className={styles.error}>
            <FaExclamationTriangle style={{ marginRight: '10px', fontSize: '1.2rem' }} />
            {bucketsError}
          </div>
        ) : (
          <div className={styles.contentContainer}>
            {filteredBuckets.length === 0 ? (
              <div className={styles.emptyState}>
                <Image 
                  src="/globe.svg" 
                  alt="No buckets" 
                  width={64} 
                  height={64} 
                  style={{ margin: '0 auto 20px', opacity: 0.5 }} 
                />
                <h3 className="text-lg font-semibold text-gray-700 mb-1">
                  {searchQuery ? "No matching buckets" : "No buckets found"}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery 
                    ? `No buckets found matching "${searchQuery}"` 
                    : "Create your first bucket to get started."}
                </p>
                {!searchQuery && (
                  <button
                    className={styles.createButton}
                    onClick={() => setShowCreateModal(true)}
                  >
                    <FaPlus className={styles.createButtonIcon} /> Create Bucket
                  </button>
                )}
              </div>
            ) : (
              <ul className={styles.bucketList}>
                {filteredBuckets.map((bucket) => (
                  <li key={bucket.Name} className={styles.bucketItem}>
                    <Link href={`/bucket/${bucket.Name}`} className="block h-full">
                      <div className={styles.bucketCard}>
                        <div className={styles.cardIcon}>
                          <FaBox />
                        </div>
                        <h3>{bucket.Name}</h3>
                        {bucket.CreationDate && (
                          <p>
                            Created: {formatDate(bucket.CreationDate)}
                          </p>
                        )}
                        <div
                          className={`${styles.statusBadge} ${
                            bucket.Status === "active" 
                              ? styles.statusActive 
                              : styles.statusInactive
                          }`}
                        >
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                            bucket.Status === "active" 
                              ? "bg-green-500" 
                              : "bg-gray-400"
                          }`}></span>
                          <span>{bucket.Status === "active" ? "Active" : "Inactive"}</span>
                        </div>
                        <div className={styles.cardFooter}>
                          <span className="text-blue-600">View bucket contents</span>
                          <FaChevronRight className="text-blue-500" />
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        
        {/* Create Bucket Modal with improved styling */}
        {showCreateModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Create New Bucket</h2>
              <div className="mb-5">
                <label className="block text-gray-700 mb-2 font-medium">Bucket Name</label>
                <input 
                  className={styles.searchInput}
                  type="text" 
                  placeholder="Enter bucket name" 
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewBucketName("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  className={styles.createButton}
                  onClick={() => {
                    alert("Create bucket functionality will be implemented in the future.");
                    setShowCreateModal(false);
                    setNewBucketName("");
                  }}
                  disabled={!newBucketName.trim()}
                >
                  <FaPlus className={styles.createButtonIcon} /> Create Bucket
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}