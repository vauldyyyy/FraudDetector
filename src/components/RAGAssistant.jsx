import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Sparkles, Loader2, FileText, HelpCircle } from 'lucide-react';
import { queryRAG } from '../utils/rag-engine';

const RAGAssistant = ({ persona = 'admin', isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: persona === 'admin' 
        ? "Hello. I am the Auth & Compliance AI. I have access to NPCI circulars, RBI guidelines, and our internal fraud policies. How can I assist you with an audit today?"
        : "Hi there! I'm your AI Support Agent. I'm here to explain any blocked transactions or answer questions about your account's safety. What do you need help with?",
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userQuery = input.trim();
    const newUserMsg = { id: Date.now(), sender: 'user', text: userQuery };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsTyping(true);

    // Call the simulated RAG engine
    const responseText = await queryRAG(userQuery, persona);

    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      sender: 'bot',
      text: responseText
    }]);
    setIsTyping(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '380px',
      height: '600px',
      maxHeight: '80vh',
      background: 'var(--bg-primary)',
      borderRadius: '24px',
      boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.15), 0 0 20px rgb(0 0 0 / 0.05)',
      border: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999,
      overflow: 'hidden',
      animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: persona === 'admin' ? '#eff6ff' : '#f0fdf4',
            padding: '10px',
            borderRadius: '12px',
            color: persona === 'admin' ? 'var(--accent-blue)' : 'var(--accent-green)'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {persona === 'admin' ? 'Compliance AI' : 'Support AI'}
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {persona === 'admin' ? <><FileText size={10} /> RAG Enabled</> : <><HelpCircle size={10} /> 24/7 Agent</>}
            </p>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
          padding: '8px', borderRadius: '50%', transition: 'background 0.2s',
        }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
          <X size={20} />
        </button>
      </div>

      {/* Chat History */}
      <div 
        ref={scrollRef}
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: '#f8fafc'
        }}
      >
        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: 'flex',
            gap: '12px',
            flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: msg.sender === 'user' ? 'var(--accent-blue)' : 'white',
              border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
              color: msg.sender === 'user' ? 'white' : 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
            }}>
              {msg.sender === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div style={{
              background: msg.sender === 'user' ? 'var(--accent-blue)' : 'white',
              color: msg.sender === 'user' ? 'white' : 'var(--text-main)',
              padding: '12px 16px',
              borderRadius: '16px',
              borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px',
              borderTopLeftRadius: msg.sender === 'bot' ? '4px' : '16px',
              fontSize: '14px',
              lineHeight: '1.5',
              boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)',
              border: msg.sender === 'bot' ? '1px solid var(--border-color)' : 'none',
              maxWidth: '85%'
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
             <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: 'white', border: '1px solid var(--border-color)', color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
            }}>
              <Bot size={14} />
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border-color)', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: '4px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px' }}>Retrieving knowledge...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ padding: '20px', background: 'white', borderTop: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={persona === 'admin' ? "Search compliance guidelines..." : "Ask about your transactions..."}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              background: '#f8fafc',
              color: 'var(--text-main)',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            style={{
              background: input.trim() && !isTyping ? 'var(--accent-blue)' : '#e2e8f0',
              color: input.trim() && !isTyping ? 'white' : 'var(--text-dim)',
              border: 'none',
              borderRadius: '12px',
              width: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      
      {/* Quick CSS for spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default RAGAssistant;
