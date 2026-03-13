import { render, screen } from '@testing-library/react';
import App from './App';

// Mocking useStore for isolated UI testing
jest.mock('./store/useStore', () => ({
  __esModule: true,
  default: () => ({
    isMobile: false,
    view: 'admin',
    activeTab: 'overview',
    alertCount: 0,
    liveTransactions: [],
    notifications: []
  })
}));

describe('UPI Fraud Shield Web App', () => {
  it('renders the main admin dashboard heading', () => {
    render(<App />);
    const headingOptions = screen.getAllByText(/UPI FRAUD SHIELD/i);
    expect(headingOptions.length).toBeGreaterThan(0);
  });

  it('renders the overview tab by default', () => {
    render(<App />);
    // The OverviewTab renders 'System Operations', so we look for this text
    const overviewHeading = screen.getByText(/System Operations/i);
    expect(overviewHeading).toBeInTheDocument();
  });
});
