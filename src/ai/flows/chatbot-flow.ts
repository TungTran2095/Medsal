import { OpenAI } from 'openai';
import { chatbotFunctions } from '../tools/chatbot-functions';
import {
  handleSearchRevenue,
  handleSearchSalary,
  handleCompareRevenueSalary
} from '../tools/chatbot-handlers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processChatbotMessage(message: string) {
  try {
    // Gọi API OpenAI với function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `Bạn là một trợ lý ảo chuyên về quản lý doanh thu và lương. 
          Khi người dùng hỏi về doanh thu hoặc lương, bạn phải:
          1. Tự động trích xuất thông tin năm, tháng, địa điểm từ câu hỏi
          2. Gọi function tương ứng để lấy dữ liệu
          3. Trả về kết quả trực tiếp với định dạng dễ đọc
          4. Nếu không có đủ thông tin, sử dụng năm và tháng hiện tại
          5. Luôn trả về số tiền với định dạng có dấu phẩy ngăn cách hàng nghìn`
        },
        {
          role: "user",
          content: message
        }
      ],
      functions: Object.values(chatbotFunctions),
      function_call: "auto"
    });

    const responseMessage = response.choices[0].message;

    // Xử lý function call nếu có
    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      let functionResult;
      switch (functionName) {
        case 'searchRevenue':
          functionResult = await handleSearchRevenue(functionArgs);
          break;
        case 'searchSalary':
          functionResult = await handleSearchSalary(functionArgs);
          break;
        case 'compareRevenueSalary':
          functionResult = await handleCompareRevenueSalary(functionArgs);
          break;
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      // Gửi kết quả function call cho GPT để tạo phản hồi
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `Bạn là một trợ lý ảo chuyên về quản lý doanh thu và lương.
            Khi nhận được kết quả từ function, bạn phải:
            1. Trả về kết quả trực tiếp, không hỏi thêm
            2. Định dạng số tiền với dấu phẩy ngăn cách hàng nghìn
            3. Nếu có nhiều kết quả, tổng hợp và hiển thị tổng
            4. Nếu không có kết quả, thông báo "Không tìm thấy dữ liệu"
            5. Luôn trả lời bằng tiếng Việt`
          },
          {
            role: "user",
            content: message
          },
          responseMessage,
          {
            role: "function",
            name: functionName,
            content: JSON.stringify(functionResult)
          }
        ]
      });

      return secondResponse.choices[0].message.content;
    }

    // Nếu không có function call, trả về phản hồi trực tiếp
    return responseMessage.content;
  } catch (error) {
    console.error('Error processing chatbot message:', error);
    return 'Xin lỗi, đã có lỗi xảy ra khi xử lý yêu cầu của bạn.';
  }
} 