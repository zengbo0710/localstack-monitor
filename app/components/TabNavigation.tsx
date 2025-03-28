'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FaBox } from 'react-icons/fa';
import { FiMessageSquare, FiActivity } from 'react-icons/fi';
import styles from './tabNavigation.module.css';

interface TabNavigationProps {
  className?: string;
}

export default function TabNavigation({ className = '' }: TabNavigationProps) {
  const pathname = usePathname();

  // Define tabs with their paths, icons, and labels
  const tabs = [
    {
      path: '/health',
      icon: <FiActivity className={styles.tabIcon} />,
      label: 'Health Status'
    },
    {
      path: '/dashboard',
      icon: <FaBox className={styles.tabIcon} />,
      label: 'S3 Buckets'
    },
    {
      path: '/queues',
      icon: <FiMessageSquare className={styles.tabIcon} />,
      label: 'SQS Queues'
    }
  ];

  return (
    <nav className={`${styles.tabs} ${className}`} role="navigation" aria-label="Main Navigation">
      {tabs.map((tab) => {
        // Check if current path matches this tab
        const isActive = pathname === tab.path;
        
        return (
          <Link 
            href={tab.path} 
            key={tab.path} 
            className={`${styles.tab} ${isActive ? styles.activeTab : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className={styles.tabIconContainer}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}