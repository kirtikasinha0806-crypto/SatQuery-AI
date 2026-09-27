import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  User, 
  Send, 
  Settings, 
  Download, 
  RefreshCw, 
  ShieldCheck, 
  Activity, 
  Sparkles, 
  HelpCircle, 
  AlertTriangle,
  X
} from 'lucide-react';
import { VLM_PROVIDERS } from '../services/vlmProvider';

export default function AssistantChat({
  messages = [],
  onSendMessage,
  isProcessing,
  providerConfig,
  setProviderConfig,
  activeScene,
  analysisData,
  changeData,
  onResetSession
}) {
  const [inputQuery, setInputQuery] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputQuery.trim() || isProcessing) return;
    onSendMessage(inputQuery.trim());
    setInputQuery('');
  };

  const handleSuggestionClick = (queryText) => {
    if (isProcessing) return;
    onSendMessage(queryText);
  };

  const exportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      activeScene: {
        id: activeScene?.id,
        name: activeScene?.name,
        region: activeScene?.region,
        sensor: activeScene?.metadata?.sensor,
        crs: activeScene?.metadata?.crs,
        resolution: activeScene?.metadata?.resolution,
        bounds: activeScene?.metadata?.bounds,
        center: activeScene?.metadata?.center
      },
      computedAnalysis: {
        lulcStats: analysisData?.lulc?.stats,
        detectedObjects: analysisData?.objects?.countsByLabel,
        spectralIndices: analysisData?.stats?.indices,
        biTemporalChange: changeData ? {
          totalChangePercentage: changeData.changePercentage,
          changedAreaKm2: changeData.changedAreaKm2,
          breakdown: changeData.breakdown
        } : null
      },
      conversationHistory: messages
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SatQuery_Report_${activeScene?.id || 'scene'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const suggestions = [
    'What do you see in this image?',
    'Where is the water?',
    'How much area appears flooded?',
    'Count the ships / buildings',
    'What is the land-use breakdown?',
    'Identify major changes between images',
    'What satellite metadata is available?'
  ];

  return (
    <aside style={{
      width: '360px',
      minWidth: '360px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderLeft: '1px solid #1e293b',
      background: '#0d1527',
      userSelect: 'none'
    }}>
      {/* 1. Assistant Heading & Short Explanation */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid #1e293b',
        background: '#0b1120',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '5px',
            background: '#1e293b',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8'
          }}>
            <Bot size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
              Vision-Language Assistant
            </div>
            <div style={{ fontSize: '10.5px', color: '#64748b' }}>
              Grounded multimodal remote sensing reasoning
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {onResetSession && (
            <button
              onClick={onResetSession}
              title="Reset Conversation & Session"
              style={{ width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #334155', background: '#141f36', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <RefreshCw size={12} />
            </button>
          )}
          <button
            onClick={exportReport}
            title="Export Report (JSON)"
            style={{ width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #334155', background: '#141f36', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Download size={12} />
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            title="VLM Provider Settings"
            style={{ width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #334155', background: '#141f36', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Settings size={12} />
          </button>
        </div>
      </div>

      {/* 2. Conversation History Thread */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        userSelect: 'text'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 10px', color: '#64748b' }}>
            <Bot size={28} color="#334155" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#94a3b8', marginBottom: '2px' }}>Awaiting Query</div>
            <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
              Select a suggested question below or enter a custom query about the active satellite image.
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* User Query Message */}
              {msg.role === 'user' ? (
                <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end', maxWidth: '88%' }}>
                  <div style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    padding: '8px 10px',
                    borderRadius: '8px 8px 1px 8px',
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <User size={11} color="#94a3b8" />
                  </div>
                </div>
              ) : (
                /* Assistant Grounded Message */
                <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-start', width: '100%' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: '#141f36', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Bot size={12} color="#38bdf8" />
                  </div>

                  <div style={{
                    flex: 1,
                    background: '#111827',
                    border: '1px solid #1e293b',
                    borderRadius: '1px 8px 8px 8px',
                    padding: '10px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    lineHeight: '1.45'
                  }}>
                    {msg.systemNote && (
                      <div style={{ fontSize: '10px', color: '#f59e0b', marginBottom: '6px', padding: '3px 6px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        {msg.systemNote}
                      </div>
                    )}

                    {/* Grounded 4-Section Output */}
                    {msg.structured ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* 1. Confirmed Metadata */}
                        <div style={{ background: '#0b1120', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid #10b981' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <ShieldCheck size={11} /> CONFIRMED METADATA
                          </div>
                          <div style={{ whiteSpace: 'pre-line', fontSize: '11px', color: '#cbd5e1' }}>
                            {msg.structured.confirmedMetadata}
                          </div>
                        </div>

                        {/* 2. Computed Analysis */}
                        <div style={{ background: '#0b1120', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid #0284c7' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Activity size={11} /> COMPUTED ANALYSIS
                          </div>
                          <div style={{ whiteSpace: 'pre-line', fontSize: '11px', color: '#e2e8f0' }}>
                            {msg.structured.computedAnalysis}
                          </div>
                        </div>

                        {/* 3. AI Visual Interpretation */}
                        <div style={{ background: '#0b1120', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid #a855f7' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#c084fc', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Sparkles size={11} /> AI VISUAL INTERPRETATION
                          </div>
                          <div style={{ whiteSpace: 'pre-line', fontSize: '11px', color: '#cbd5e1' }}>
                            {msg.structured.aiVisualInterpretation}
                          </div>
                        </div>

                        {/* 4. Uncertain / Not Available */}
                        <div style={{ background: '#0b1120', padding: '6px 8px', borderRadius: '4px', borderLeft: '2px solid #64748b' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <HelpCircle size={11} /> UNCERTAIN / NOT AVAILABLE
                          </div>
                          <div style={{ whiteSpace: 'pre-line', fontSize: '11px', color: '#94a3b8' }}>
                            {msg.structured.uncertainNotAvailable}
                          </div>
                        </div>

                        {/* Metric Summary Badges */}
                        {msg.structured.keyMetrics?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                            {msg.structured.keyMetrics.map((km, ki) => (
                              <div key={ki} style={{ padding: '2px 6px', borderRadius: '3px', background: '#1e293b', fontSize: '10px', display: 'flex', gap: '4px' }}>
                                <span style={{ color: '#94a3b8' }}>{km.label}:</span>
                                <strong style={{ color: '#38bdf8' }}>{km.value}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading State Indicator */}
        {isProcessing && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 10px', background: '#111827', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <RefreshCw size={12} color="#0284c7" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Computing remote-sensing indices & visual context...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Suggested Questions */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #1e293b', background: '#0b1120' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
          Suggested Questions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '64px', overflowY: 'auto' }}>
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(sug)}
              disabled={isProcessing}
              style={{
                padding: '3px 7px',
                borderRadius: '3px',
                fontSize: '10px',
                background: '#141f36',
                color: '#cbd5e1',
                border: '1px solid #334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.12s'
              }}
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Query Input Box */}
      <form onSubmit={handleSubmit} style={{ padding: '10px', borderTop: '1px solid #1e293b', background: '#0d1527', display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask a question about the active scene..."
          disabled={isProcessing}
          style={{
            flex: 1,
            padding: '7px 9px',
            borderRadius: '4px',
            background: '#111827',
            color: '#f8fafc',
            border: '1px solid #334155',
            fontSize: '11.5px',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isProcessing}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '4px',
            background: inputQuery.trim() && !isProcessing ? '#0284c7' : '#1e293b',
            color: '#ffffff',
            border: 'none',
            cursor: inputQuery.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Send size={13} />
        </button>
      </form>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ width: '380px', background: '#111827', border: '1px solid #334155', borderRadius: '8px', padding: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#f8fafc' }}>VLM Provider Settings</div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Provider
                </label>
                <select
                  value={providerConfig.provider}
                  onChange={(e) => setProviderConfig(p => ({ ...p, provider: e.target.value }))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#0b101d', border: '1px solid #334155', color: '#f8fafc', fontSize: '11.5px' }}
                >
                  {VLM_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {providerConfig.provider === 'gemini' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    Google AI Studio Key
                  </label>
                  <input
                    type="password"
                    value={providerConfig.apiKey || ''}
                    onChange={(e) => setProviderConfig(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#0b101d', border: '1px solid #334155', color: '#f8fafc', fontSize: '11.5px' }}
                  />
                </div>
              )}

              {providerConfig.provider === 'openai_custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                      API Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={providerConfig.endpoint || ''}
                      onChange={(e) => setProviderConfig(p => ({ ...p, endpoint: e.target.value }))}
                      placeholder="http://localhost:11434/v1/chat/completions"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#0b101d', border: '1px solid #334155', color: '#f8fafc', fontSize: '11.5px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                      Model Name
                    </label>
                    <input
                      type="text"
                      value={providerConfig.modelName || ''}
                      onChange={(e) => setProviderConfig(p => ({ ...p, modelName: e.target.value }))}
                      placeholder="gpt-4o-mini"
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#0b101d', border: '1px solid #334155', color: '#f8fafc', fontSize: '11.5px' }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowSettingsModal(false)}
                style={{ marginTop: '6px', padding: '7px', borderRadius: '4px', background: '#0284c7', color: '#ffffff', border: 'none', fontWeight: 600, fontSize: '11.5px', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
