import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JourneyWiseSummary } from './JourneyWiseSummary';
import type { JourneySummaryItem } from '../services/locationMobilityService';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('JourneyWiseSummary Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockJourneys: JourneySummaryItem[] = [
    {
      id: 'jrn-1',
      title: 'Morning Office Commute',
      status: 'completed',
      startTime: '2026-10-25T08:00:00.000Z',
      endTime: '2026-10-25T08:35:00.000Z',
      travelTimeSeconds: 2100,
      totalDistanceKm: 14.8,
      avgSpeedKmh: 42.5,
      maxSpeedKmh: 68.0,
      estimatedCost: 2.66,
      isCostLogged: false,
      primaryTransportMode: 'vehicle',
      isBusinessTrip: true,
      taxDeductionAmount: 9.92,
      startLatitude: 6.9271,
      startLongitude: 79.8612,
      endLatitude: 6.8700,
      endLongitude: 79.8600,
      pingsCount: 35,
    },
    {
      id: 'jrn-2',
      title: 'Lunch Errand',
      status: 'completed',
      startTime: '2026-10-25T12:30:00.000Z',
      endTime: '2026-10-25T12:45:00.000Z',
      travelTimeSeconds: 900,
      totalDistanceKm: 1.2,
      avgSpeedKmh: 4.8,
      maxSpeedKmh: 5.5,
      estimatedCost: 0,
      isCostLogged: true,
      loggedTransitCost: 0,
      primaryTransportMode: 'walking',
      isBusinessTrip: false,
      startLatitude: 6.8700,
      startLongitude: 79.8600,
      endLatitude: 6.8650,
      endLongitude: 79.8620,
      pingsCount: 12,
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders aggregate summary metrics and KPI badges', () => {
    const onSelectJourney = vi.fn();
    const onStraightAwaySubmit = vi.fn().mockResolvedValue(undefined);
    const onEditAndSubmit = vi.fn();

    act(() => {
      root.render(
        <JourneyWiseSummary
          userId="usr-1"
          selectedDate="2026-10-25"
          journeys={mockJourneys}
          currencySymbol="$"
          selectedJourneyId={null}
          onSelectJourney={onSelectJourney}
          onStraightAwaySubmit={onStraightAwaySubmit}
          onEditAndSubmit={onEditAndSubmit}
        />
      );
    });

    expect(container.textContent).toContain('Journey-Wise Summary');
    expect(container.textContent).toContain('2 Journeys');
    expect(container.textContent).toContain('16.0'); // 14.8 + 1.2 km
    expect(container.textContent).toContain('$2.66'); // Est cost
  });

  it('renders journey cards stacked one under one in a flex grid', () => {
    act(() => {
      root.render(
        <JourneyWiseSummary
          userId="usr-1"
          selectedDate="2026-10-25"
          journeys={mockJourneys}
          currencySymbol="$"
          selectedJourneyId={null}
          onSelectJourney={vi.fn()}
          onStraightAwaySubmit={vi.fn().mockResolvedValue(undefined)}
          onEditAndSubmit={vi.fn()}
        />
      );
    });

    // Check flex grid container
    const flexGrid = container.querySelector('.flex.flex-col.gap-4\\.5');
    expect(flexGrid).not.toBeNull();

    // Verify both journey titles appear
    expect(container.textContent).toContain('Morning Office Commute');
    expect(container.textContent).toContain('Lunch Errand');
    expect(container.textContent).toContain('#1');
    expect(container.textContent).toContain('#2');

    // Verify Straight-Away Submit button is available for pending journey
    expect(container.textContent).toContain('Straight-Away Submit');
    // Verify logged journey displays status
    expect(container.textContent).toContain('Recorded to Ledger');
  });

  it('triggers onSelectJourney when Focus on Map is clicked', () => {
    const onSelectJourney = vi.fn();

    act(() => {
      root.render(
        <JourneyWiseSummary
          userId="usr-1"
          selectedDate="2026-10-25"
          journeys={mockJourneys}
          currencySymbol="$"
          selectedJourneyId={null}
          onSelectJourney={onSelectJourney}
          onStraightAwaySubmit={vi.fn().mockResolvedValue(undefined)}
          onEditAndSubmit={vi.fn()}
        />
      );
    });

    const focusButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Focus on Map')
    );
    expect(focusButtons.length).toBeGreaterThan(0);

    act(() => {
      focusButtons[0].click();
    });

    expect(onSelectJourney).toHaveBeenCalledWith('jrn-1');
  });

  it('triggers onStraightAwaySubmit with metrics when straight-away submit button is clicked', async () => {
    const onStraightAwaySubmit = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root.render(
        <JourneyWiseSummary
          userId="usr-1"
          selectedDate="2026-10-25"
          journeys={mockJourneys}
          currencySymbol="$"
          selectedJourneyId={null}
          onSelectJourney={vi.fn()}
          onStraightAwaySubmit={onStraightAwaySubmit}
          onEditAndSubmit={vi.fn()}
        />
      );
    });

    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Straight-Away Submit')
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(onStraightAwaySubmit).toHaveBeenCalled();
    const passedMetrics = onStraightAwaySubmit.mock.calls[0][0];
    expect(passedMetrics.journeyId).toBe('jrn-1');
    expect(passedMetrics.totalDistanceKm).toBe(14.8);
  });
});
