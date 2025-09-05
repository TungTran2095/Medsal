"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { chatService } from '@/lib/chatService';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function SupabaseTest() {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    connection: 'pending' | 'success' | 'error';
    tableExists: 'pending' | 'success' | 'error';
    insertTest: 'pending' | 'success' | 'error';
    selectTest: 'pending' | 'success' | 'error';
  }>({
    connection: 'pending',
    tableExists: 'pending',
    insertTest: 'pending',
    selectTest: 'pending'
  });

  const [errorMessage, setErrorMessage] = useState('');

  const runTests = async () => {
    setIsTesting(true);
    setErrorMessage('');
    setTestResults({
      connection: 'pending',
      tableExists: 'pending',
      insertTest: 'pending',
      selectTest: 'pending'
    });

    try {
      // Test 1: Kiểm tra kết nối Supabase
      console.log('🧪 Test 1: Kiểm tra kết nối Supabase...');
      const { data: connectionData, error: connectionError } = await supabase
        .from('chat_messages')
        .select('count')
        .limit(1);
      
      if (connectionError) {
        console.error('❌ Lỗi kết nối:', connectionError);
        setTestResults(prev => ({ ...prev, connection: 'error' }));
        setErrorMessage(`Lỗi kết nối: ${connectionError.message}`);
        return;
      }
      
      console.log('✅ Kết nối thành công');
      setTestResults(prev => ({ ...prev, connection: 'success' }));

      // Test 2: Kiểm tra bảng tồn tại
      console.log('🧪 Test 2: Kiểm tra bảng chat_messages...');
      const { data: tableData, error: tableError } = await supabase
        .from('chat_messages')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error('❌ Lỗi bảng:', tableError);
        setTestResults(prev => ({ ...prev, tableExists: 'error' }));
        setErrorMessage(`Lỗi bảng: ${tableError.message}`);
        return;
      }
      
      console.log('✅ Bảng tồn tại');
      setTestResults(prev => ({ ...prev, tableExists: 'success' }));

      // Test 3: Test insert
      console.log('🧪 Test 3: Test insert tin nhắn...');
      const testMessage = {
        user_id: 'test_user_' + Date.now(),
        message_text: 'Test message from debug component',
        sender: 'user' as const,
        timestamp: new Date().toISOString(),
        session_id: 'test_session_' + Date.now()
      };

      const { data: insertData, error: insertError } = await supabase
        .from('chat_messages')
        .insert([testMessage])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Lỗi insert:', insertError);
        setTestResults(prev => ({ ...prev, insertTest: 'error' }));
        setErrorMessage(`Lỗi insert: ${insertError.message}`);
        return;
      }
      
      console.log('✅ Insert thành công:', insertData);
      setTestResults(prev => ({ ...prev, insertTest: 'success' }));

      // Test 4: Test select
      console.log('🧪 Test 4: Test select tin nhắn...');
      const { data: selectData, error: selectError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', insertData.id);

      if (selectError) {
        console.error('❌ Lỗi select:', selectError);
        setTestResults(prev => ({ ...prev, selectTest: 'error' }));
        setErrorMessage(`Lỗi select: ${selectError.message}`);
        return;
      }
      
      console.log('✅ Select thành công:', selectData);
      setTestResults(prev => ({ ...prev, selectTest: 'success' }));

      // Cleanup: Xóa tin nhắn test
      await supabase
        .from('chat_messages')
        .delete()
        .eq('id', insertData.id);

    } catch (error) {
      console.error('❌ Lỗi tổng quát:', error);
      setErrorMessage(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Thành công';
      case 'error':
        return 'Lỗi';
      default:
        return 'Đang kiểm tra...';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🧪 Supabase Connection Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon(testResults.connection)}
            <span>Kết nối Supabase</span>
            <Badge variant={testResults.connection === 'success' ? 'default' : testResults.connection === 'error' ? 'destructive' : 'secondary'}>
              {getStatusText(testResults.connection)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(testResults.tableExists)}
            <span>Bảng chat_messages</span>
            <Badge variant={testResults.tableExists === 'success' ? 'default' : testResults.tableExists === 'error' ? 'destructive' : 'secondary'}>
              {getStatusText(testResults.tableExists)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(testResults.insertTest)}
            <span>Test Insert</span>
            <Badge variant={testResults.insertTest === 'success' ? 'default' : testResults.insertTest === 'error' ? 'destructive' : 'secondary'}>
              {getStatusText(testResults.insertTest)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(testResults.selectTest)}
            <span>Test Select</span>
            <Badge variant={testResults.selectTest === 'success' ? 'default' : testResults.selectTest === 'error' ? 'destructive' : 'secondary'}>
              {getStatusText(testResults.selectTest)}
            </Badge>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        )}

        <Button 
          onClick={runTests} 
          disabled={isTesting}
          className="w-full"
        >
          {isTesting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            'Chạy Test Kết Nối'
          )}
        </Button>

        <div className="text-xs text-muted-foreground">
          <p>Kiểm tra này sẽ:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Test kết nối đến Supabase</li>
            <li>Kiểm tra bảng chat_messages có tồn tại</li>
            <li>Test insert một tin nhắn mẫu</li>
            <li>Test select tin nhắn vừa insert</li>
            <li>Xóa tin nhắn test sau khi hoàn thành</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

